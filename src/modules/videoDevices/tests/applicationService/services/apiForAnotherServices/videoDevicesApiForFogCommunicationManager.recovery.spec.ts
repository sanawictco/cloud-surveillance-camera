import { VideoDevicesApiForFogCommunicationManagerService } from '../../../../applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service';
import { NvrEntity } from '../../../../domain/nvr/nvr.entity';

describe('VideoDevicesApiForFogCommunicationManagerService recovery', () => {
  it('stops only the authenticated NVR running operations before import', async () => {
    const nvr = NvrEntity.create({
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken: '1'.repeat(32),
      maxCameras: 16,
      password: 'nvr-password',
    });
    const camera = { id: 'camera-id' };
    const queryBus = {
      execute: jest
        .fn()
        .mockResolvedValueOnce(nvr)
        .mockResolvedValueOnce([camera]),
    };
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const nvrRunningConfigs = {
      stopAndRemoveAllRunningConfigs: jest.fn().mockResolvedValue(undefined),
    };
    const cameraRunningConfigs = {
      stopAndRemoveAllRunningConfigs: jest.fn().mockResolvedValue(undefined),
    };
    const dashboardFogApi = {
      stopRunningConfigsForNvr: jest.fn().mockResolvedValue(undefined),
    };
    const websocket = {
      channels: { VIDEO_DEVICES_SOCKET: 'video-devices' },
      sendTenantMessage: jest.fn(),
    };
    const service = new VideoDevicesApiForFogCommunicationManagerService(
      {} as never,
      {} as never,
      { queryBus, commandBus } as never,
      {} as never,
      {} as never,
      {} as never,
      nvrRunningConfigs as never,
      cameraRunningConfigs as never,
      websocket as never,
      dashboardFogApi as never,
    );

    await service.startFogCloudRecovery(nvr.id);

    expect(
      nvrRunningConfigs.stopAndRemoveAllRunningConfigs,
    ).toHaveBeenCalledWith(nvr);
    expect(
      cameraRunningConfigs.stopAndRemoveAllRunningConfigs,
    ).toHaveBeenCalledWith(camera);
    expect(dashboardFogApi.stopRunningConfigsForNvr).toHaveBeenCalledWith(
      nvr.getProps().tenantId,
      nvr.id,
    );
  });
});
