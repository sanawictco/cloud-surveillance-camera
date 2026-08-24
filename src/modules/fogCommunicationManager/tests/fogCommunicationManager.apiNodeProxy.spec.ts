import { BadRequestException } from '@nestjs/common';

jest.mock(
  'src/modules/dashboard/applicationService/apiForAnotherServices/dashboardApiForFogCommunicationManager.service',
  () => ({ DashboardApiForFogCommunicationManagerService: class {} }),
);
jest.mock(
  'src/modules/videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service',
  () => ({ VideoDevicesApiForFogCommunicationManagerService: class {} }),
);

import { FogCommunicationManagerService } from '../fogCommunicationManager.service';

const request = {
  serialNumber: 'FOG00001',
  accessToken: 'a'.repeat(32),
  url: 'https://api.example.com/readings',
  method: 'GET' as const,
  parameters: [{ key: 'temperature', value: 24.5 }],
  headers: [{ key: 'x-api-key', value: 'secret' }],
};

describe('FogCommunicationManagerService API-node proxy', () => {
  let findGateway: jest.Mock;
  let execute: jest.Mock;
  let service: FogCommunicationManagerService;

  beforeEach(() => {
    findGateway = jest.fn().mockResolvedValue({
      id: 'gateway-id',
      accessToken: request.accessToken,
      cloudIsRecovering: false,
    });
    execute = jest.fn().mockResolvedValue({
      status: 200,
      data: { temperature: 24.5 },
    });
    service = new FogCommunicationManagerService(
      { findFogNvrBySerialNumber: findGateway } as never,
      {} as never,
      { execute } as never,
    );
  });

  // @spec CLOUD-API-PROXY-001-S01
  it('authenticates the Fog and dispatches one narrow target request', async () => {
    await expect(service.proxyApiNodeRequest(request)).resolves.toEqual({
      status: 200,
      data: { temperature: 24.5 },
    });
    expect(findGateway).toHaveBeenCalledWith(request.serialNumber);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      {
        url: request.url,
        method: request.method,
        parameters: request.parameters,
        headers: request.headers,
      },
      expect.any(Number),
    );
  });

  // @spec CLOUD-API-PROXY-001-S02
  it.each([
    ['unknown gateway', undefined],
    [
      'invalid access token',
      {
        id: 'gateway-id',
        accessToken: 'b'.repeat(32),
        cloudIsRecovering: false,
      },
    ],
  ])('rejects %s before target work', async (_name, gateway) => {
    findGateway.mockResolvedValue(gateway);

    await expect(service.proxyApiNodeRequest(request)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(execute).not.toHaveBeenCalled();
  });

  // @spec CLOUD-API-PROXY-001-S09
  it('does not dispatch a target after the total proxy deadline', async () => {
    jest.useFakeTimers();
    findGateway.mockImplementation(() => new Promise(() => undefined));

    const result = service.proxyApiNodeRequest(request);
    const settled = result.catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(settled).resolves.toEqual(
      expect.objectContaining({
        message: 'apiNode proxy authentication timed out',
      }),
    );
    expect(execute).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
