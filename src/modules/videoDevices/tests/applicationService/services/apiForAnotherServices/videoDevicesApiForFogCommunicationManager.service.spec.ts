import { VideoDevicesApiForFogCommunicationManagerService } from '../../../../applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service';
import { NvrEntity } from '../../../../domain/nvr/nvr.entity';
import { NvrConfigs } from '../../../../domain/nvr/nvr.type';
import { EntityTypes } from '../../../../shared/valueObjects/entityTypes';

describe('VideoDevicesApiForFogCommunicationManagerService', () => {
  const tenantId = '22222222-2222-4222-8222-222222222222';
  const accessToken = '12345678901234567890123456789012';
  const msgId = '101';

  function buildService(configType: NvrConfigs = NvrConfigs.UPDATE) {
    const nvr = NvrEntity.create({
      tenantId,
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken,
      maxCameras: 16,
      password: 'nvr-password',
    });
    const data = { id: nvr.id };
    const queued = {
      msgId,
      nvrId: nvr.id,
      tenantId,
      configType,
      data,
      metadata: {
        topic: nvr.getCloudPubToFogMqttTopics().videoDeviceConfigs,
        entityId: nvr.id,
        entityType: EntityTypes.NVR,
        issuedAt: Date.now() - 1000,
        expiresAt: Date.now() + 60_000,
      },
    };
    const queue = { getRepeatableMsg: jest.fn().mockResolvedValue(queued) };
    const validator = {
      checkExistsNvrBySerialNumber: jest.fn().mockResolvedValue(nvr),
    };
    const dashboardFogApi = {
      getOwnedPageConfig: jest.fn().mockResolvedValue({
        configType: 'CREATE_PAGE',
        data: { id: 'page-id' },
      }),
    };
    const service = new VideoDevicesApiForFogCommunicationManagerService(
      validator as never,
      queue as never,
      { queryBus: { execute: jest.fn() } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      dashboardFogApi as never,
    );
    return { service, nvr, queue, queued, data, dashboardFogApi };
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
    const context = buildService(configType);

    await expect(
      context.service.getOwnedFogConfig({
        serialNumber: 'NVR00001',
        accessToken,
        msgId,
        configType: 'videoDevice',
      }),
    ).resolves.toEqual({ configType, data: context.data });
    expect(context.queue.getRepeatableMsg).toHaveBeenCalledWith(
      tenantId,
      context.nvr.id,
      msgId,
    );
  });

  it('rejects an expired NVR configuration', async () => {
    const context = buildService();
    context.queued.metadata.expiresAt = Date.now() - 1;

    await expect(
      context.service.getOwnedFogConfig({
        serialNumber: 'NVR00001',
        accessToken,
        msgId,
        configType: 'videoDevice',
      }),
    ).rejects.toThrow('configuration is unavailable');
  });

  it('rejects a configuration owned by another tenant', async () => {
    const context = buildService();
    context.queued.tenantId = '33333333-3333-4333-8333-333333333333';

    await expect(
      context.service.getOwnedFogConfig({
        serialNumber: 'NVR00001',
        accessToken,
        msgId,
        configType: 'videoDevice',
      }),
    ).rejects.toThrow('configuration is unavailable');
  });

  it('rejects invalid credentials before queue lookup', async () => {
    const context = buildService();

    await expect(
      context.service.getOwnedFogConfig({
        serialNumber: 'NVR00001',
        accessToken: 'x'.repeat(32),
        msgId,
        configType: 'videoDevice',
      }),
    ).rejects.toThrow('configuration is unavailable');
    expect(context.queue.getRepeatableMsg).not.toHaveBeenCalled();
  });

  it('loads a page configuration with the authenticated NVR scope', async () => {
    const context = buildService();

    await expect(
      context.service.getOwnedFogConfig({
        serialNumber: 'NVR00001',
        accessToken,
        msgId,
        configType: 'page',
      }),
    ).resolves.toEqual({
      configType: 'CREATE_PAGE',
      data: { id: 'page-id' },
    });
    expect(context.dashboardFogApi.getOwnedPageConfig).toHaveBeenCalledWith(
      tenantId,
      context.nvr.id,
      msgId,
    );
    expect(context.queue.getRepeatableMsg).not.toHaveBeenCalled();
  });
});
