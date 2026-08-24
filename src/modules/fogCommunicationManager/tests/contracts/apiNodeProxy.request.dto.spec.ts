import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ApiNodeProxyMethod,
  ApiNodeProxyRequestDto,
} from '../../contracts/apiNodeProxy.request.dto';

const validRequest = {
  serialNumber: 'FOG00001',
  accessToken: 'a'.repeat(32),
  url: 'https://api.example.com/readings?existing=1',
  method: ApiNodeProxyMethod.POST,
  parameters: [{ key: 'temperature', value: 24.5 }],
  headers: [{ key: 'x-api-key', value: 'secret-value' }],
};

describe('ApiNodeProxyRequestDto', () => {
  const validateRequest = (value: Record<string, unknown>) =>
    validate(plainToInstance(ApiNodeProxyRequestDto, value), {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

  // @spec CLOUD-API-PROXY-001-S03
  it('accepts the bounded query-only GET and POST contract', async () => {
    await expect(validateRequest(validRequest)).resolves.toEqual([]);
    await expect(
      validateRequest({ ...validRequest, method: ApiNodeProxyMethod.GET }),
    ).resolves.toEqual([]);
  });

  // @spec CLOUD-API-PROXY-001-S10
  it.each(['Host', 'content-length', 'Proxy-Authorization', 'Connection'])(
    'rejects reserved target header %s',
    async (key) => {
      const errors = await validateRequest({
        ...validRequest,
        headers: [{ key, value: 'unsafe' }],
      });

      expect(errors).not.toEqual([]);
    },
  );

  it('rejects unsupported methods and unknown fields', async () => {
    await expect(
      validateRequest({ ...validRequest, method: 'PUT' }),
    ).resolves.not.toEqual([]);
    await expect(
      validateRequest({ ...validRequest, timeout: 60_000 }),
    ).resolves.not.toEqual([]);
  });

  it('rejects CRLF injection in target header values', async () => {
    await expect(
      validateRequest({
        ...validRequest,
        headers: [{ key: 'x-api-key', value: 'secret\r\nx-injected: true' }],
      }),
    ).resolves.not.toEqual([]);
  });
});
