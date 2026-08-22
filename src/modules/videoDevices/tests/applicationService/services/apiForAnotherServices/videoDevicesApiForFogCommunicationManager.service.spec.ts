import { VideoDevicesApiForFogCommunicationManagerService } from '../../../../applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service';
import { NvrConfigs } from '../../../../domain/nvr/nvr.type';
import { VideoDeviceEntityTypes } from '../../../../shared/valueObjects/videoDeviceEntityTypes';

describe('VideoDevicesApiForFogCommunicationManagerService', () => {
  const nvr = {
    id: '11111111-1111-4111-8111-111111111111',
    getProps: () => ({
      tenantId: '22222222-2222-4222-8222-222222222222',
      accessToken: '12345678901234567890123456789012',
    }),
  };

  function buildService(configType: NvrConfigs) {
    const data = { id: nvr.id };
    const queue = {
      getRepeatableMsg: jest.fn().mockResolvedValue({
        msgId: 'msg-id',
        nvrId: nvr.id,
        tenantId: nvr.getProps().tenantId,
        configType,
        data,
        metadata: {
          entityId: nvr.id,
          entityType: VideoDeviceEntityTypes.NVR,
        },
      }),
    };
    const validator = {
      checkExistsNvrBySerialNumber: jest.fn().mockResolvedValue(nvr),
    };
    const service = new VideoDevicesApiForFogCommunicationManagerService(
      validator as never,
      queue as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, data };
  }

  it.each([
    NvrConfigs.UPDATE,
    NvrConfigs.DELETE,
    NvrConfigs.ACTIVE,
    NvrConfigs.IN_ACTIVE,
    NvrConfigs.FOG_LIVE_SIGNAL,
    NvrConfigs.CLOUD_IS_RECOVERING,
    NvrConfigs.SEARCH,
    NvrConfigs.REGISTER,
  ])('returns an owned %s NVR configuration', async (configType) => {
    const { service, data } = buildService(configType);

    await expect(
      service.getOwnedVideoDeviceConfig({
        serialNumber: 'NVR00001',
        accessToken: nvr.getProps().accessToken,
        msgId: 'msg-id',
        configType: 'videoDevice',
      }),
    ).resolves.toEqual({ configType, data });
  });

  it('rejects an NVR enum value that has no Fog config handler', async () => {
    const { service } = buildService(NvrConfigs.SOFT_DELETE_MULTI_CAMERAS);

    await expect(
      service.getOwnedVideoDeviceConfig({
        serialNumber: 'NVR00001',
        accessToken: nvr.getProps().accessToken,
        msgId: 'msg-id',
        configType: 'videoDevice',
      }),
    ).rejects.toThrow('configuration is unavailable');
  });
});
