import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import {
  FogNvrProjection,
  VideoDevicesApiForFogCommunicationManagerService,
} from '../videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service';

export interface AuthenticatedFogBackupRequest extends Request {
  fogNvr: FogNvrProjection;
}

@Injectable()
export class FogBackupAuthGuard implements CanActivate {
  constructor(
    private readonly fogApi: VideoDevicesApiForFogCommunicationManagerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedFogBackupRequest>();
    const tenantId = this.header(request, 'x-tenant-id');
    const serialNumber = this.header(request, 'x-nvr-serial-number');
    const accessToken = this.header(request, 'x-nvr-access-token');

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        tenantId,
      ) ||
      !/^[A-Z0-9]{8}$/.test(serialNumber) ||
      accessToken.length !== 32
    ) {
      throw new BadRequestException('invalid nvr');
    }

    const nvr = await this.fogApi.findFogNvrBySerialNumber(serialNumber);
    if (
      !nvr ||
      nvr.tenantId !== tenantId ||
      !this.tokensMatch(nvr.accessToken, accessToken)
    ) {
      throw new BadRequestException('invalid nvr');
    }
    request.fogNvr = nvr;
    return true;
  }

  private header(request: Request, name: string): string {
    const value = request.headers[name];
    return typeof value === 'string' ? value : '';
  }

  private tokensMatch(expected: string, supplied: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);
    return (
      expectedBuffer.length === suppliedBuffer.length &&
      timingSafeEqual(expectedBuffer, suppliedBuffer)
    );
  }
}
