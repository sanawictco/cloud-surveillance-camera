import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import AppConfig from 'configs/app.config';
import { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { BlockList, isIP, LookupFunction } from 'node:net';
import { HttpService } from './http.service';

const TARGET_TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 64 * 1024;

const blockedIpv4 = new BlockList();
[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].forEach(([address, prefix]) =>
  blockedIpv4.addSubnet(address as string, prefix as number, 'ipv4'),
);

const blockedIpv6 = new BlockList();
[
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
  ['5f00::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
].forEach(([address, prefix]) =>
  blockedIpv6.addSubnet(address as string, prefix as number, 'ipv6'),
);

function mappedIpv4(address: string): string | undefined {
  const match = address.toLowerCase().match(/^::ffff:(.+)$/);
  if (!match) return undefined;
  const tail = match[1] as string;
  if (isIP(tail) === 4) return tail;
  const words = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!words) return undefined;
  const high = Number.parseInt(words[1] as string, 16);
  const low = Number.parseInt(words[2] as string, 16);
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

export function apiNodeTargetAddressIsPublic(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4.check(address, 'ipv4');
  if (family !== 6) return false;
  const embeddedIpv4 = mappedIpv4(address);
  if (embeddedIpv4) return apiNodeTargetAddressIsPublic(embeddedIpv4);
  return !blockedIpv6.check(address, 'ipv6');
}

function normalizeHostname(hostname: string): string {
  return hostname
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
    .replace(/\.$/, '');
}

export function apiNodeHostIsAllowed(
  hostname: string,
  allowedHosts: string[],
): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  return allowedHosts.some((entry) => {
    const normalizedEntry = entry.toLowerCase().replace(/\.$/, '');
    if (normalizedEntry === '*') return true;
    if (!normalizedEntry.startsWith('*.'))
      return normalizedHostname === normalizedEntry;
    const suffix = normalizedEntry.slice(2);
    return (
      normalizedHostname !== suffix && normalizedHostname.endsWith(`.${suffix}`)
    );
  });
}

interface ProxyTargetInput {
  url: string;
  method: 'GET' | 'POST';
  parameters: Array<{ key: string; value: string | number | boolean }>;
  headers: Array<{ key: string; value: string }>;
}

@Injectable()
export class ApiNodeProxyService {
  constructor(private readonly httpService: HttpService) {}

  async execute(
    input: ProxyTargetInput,
    requestDeadlineAt?: number,
  ): Promise<{
    status: number;
    data: unknown;
  }> {
    const deadlineAt = Math.min(
      Date.now() + TARGET_TIMEOUT_MS,
      requestDeadlineAt ?? Number.POSITIVE_INFINITY,
    );
    if (deadlineAt <= Date.now())
      throw new GatewayTimeoutException('apiNode proxy deadline expired');
    const target = this.parseTarget(input.url);
    const hostname = normalizeHostname(target.hostname);
    if (!apiNodeHostIsAllowed(hostname, AppConfig().apiNodeProxy.allowedHosts))
      throw new BadRequestException('apiNode target host is not allowed');

    const resolved = await this.resolvePublicAddress(hostname, deadlineAt);
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0)
      throw new GatewayTimeoutException('apiNode target request timed out');
    const pinnedLookup = this.createPinnedLookup(
      resolved.address,
      resolved.family,
    );
    const httpAgent = new HttpAgent({ lookup: pinnedLookup });
    const httpsAgent = new HttpsAgent({ lookup: pinnedLookup });

    try {
      const response = await this.httpService.request({
        url: target.toString(),
        method: input.method,
        params: Object.fromEntries(
          input.parameters.map(({ key, value }) => [key, value]),
        ),
        headers: Object.fromEntries(
          input.headers.map(({ key, value }) => [key, value]),
        ),
        timeout: remainingMs,
        signal: AbortSignal.timeout(remainingMs),
        skipRetry: true,
        maxRedirects: 0,
        maxContentLength: MAX_BODY_BYTES,
        maxBodyLength: MAX_BODY_BYTES,
        proxy: false,
        httpAgent,
        httpsAgent,
        sensitive: true,
        safeLogUrl: target.origin,
      });
      return { status: response.status, data: response.data };
    } catch (error) {
      const status = (error as { statusCode?: unknown }).statusCode;
      if (typeof status === 'number')
        throw new BadGatewayException(`apiNode target returned HTTP ${status}`);
      const code = (error as { code?: unknown }).code;
      if (
        code === 'ECONNABORTED' ||
        code === 'ETIMEDOUT' ||
        code === 'ERR_CANCELED'
      )
        throw new GatewayTimeoutException('apiNode target request timed out');
      throw new BadGatewayException('apiNode target request failed');
    } finally {
      httpAgent.destroy();
      httpsAgent.destroy();
    }
  }

  private parseTarget(url: string): URL {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      throw new BadRequestException('apiNode target URL is invalid');
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:')
      throw new BadRequestException('apiNode target URL scheme is not allowed');
    if (target.username || target.password)
      throw new BadRequestException(
        'apiNode target URL userinfo is not allowed',
      );
    return target;
  }

  private async resolvePublicAddress(
    hostname: string,
    deadlineAt: number,
  ): Promise<{ address: string; family: 4 | 6 }> {
    if (isIP(hostname) !== 0) {
      if (!apiNodeTargetAddressIsPublic(hostname))
        throw new BadRequestException('apiNode target address is not public');
      return { address: hostname, family: isIP(hostname) as 4 | 6 };
    }

    let addresses: LookupAddress[];
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0)
        throw new GatewayTimeoutException(
          'apiNode target DNS lookup timed out',
        );
      addresses = await Promise.race([
        lookup(hostname, { all: true, verbatim: true }),
        new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(
            () =>
              reject(
                new GatewayTimeoutException(
                  'apiNode target DNS lookup timed out',
                ),
              ),
            remainingMs,
          );
        }),
      ]);
    } catch (error) {
      if (error instanceof GatewayTimeoutException) throw error;
      throw new BadRequestException('apiNode target host did not resolve');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
    if (!Array.isArray(addresses) || addresses.length === 0)
      throw new BadRequestException('apiNode target host did not resolve');
    if (addresses.some(({ address }) => !apiNodeTargetAddressIsPublic(address)))
      throw new BadRequestException(
        'apiNode target host resolved to a non-public address',
      );
    const selected = addresses[0];
    if (!selected || (selected.family !== 4 && selected.family !== 6))
      throw new BadRequestException('apiNode target address family is invalid');
    return { address: selected.address, family: selected.family };
  }

  private createPinnedLookup(address: string, family: 4 | 6): LookupFunction {
    return (_hostname, options, callback) => {
      if (options.all) callback(null, [{ address, family }]);
      else callback(null, address, family);
    };
  }
}
