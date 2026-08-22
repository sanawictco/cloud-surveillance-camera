import { NvrAutoProvisioningService } from '../../../applicationService/services/nvrAutoProvisioning.service';
import { NvrEntity } from '../../../domain/nvr/nvr.entity';
import { NvrConfigs } from '../../../domain/nvr/nvr.type';
import { VideoDeviceEntityTypes } from '../../../shared/valueObjects/videoDeviceEntityTypes';

describe('NvrAutoProvisioningService', () => {
  function buildService() {
    const serviceProvider = {
      queryBus: { execute: jest.fn() },
      commandBus: { execute: jest.fn() },
    };
    const cache = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    };
    const queue = {
      getRepeatableMsg: jest.fn(),
      getAndDeleteRepeatableMsg: jest.fn(),
    };
    const runningConfigs = {
      doneAndUnlockConfig: jest.fn().mockResolvedValue(true),
    };
    const sanawApi = { getNvrCameraSearchInfo: jest.fn() };
    const websocket = {
      channels: { DEVICES_SOCKET: 'DevicesSocket' },
      sendMessage: jest.fn(),
    };
    const nvrLiveSignal = { toConncted: jest.fn() };
    const service = new NvrAutoProvisioningService(
      serviceProvider as never,
      cache as never,
      queue as never,
      runningConfigs as never,
      sanawApi as never,
      websocket as never,
      nvrLiveSignal as never,
    );
    return {
      service,
      serviceProvider,
      cache,
      queue,
      runningConfigs,
      websocket,
      sanawApi,
      nvrLiveSignal,
    };
  }

  it('rejects an invalid topic before reading or consuming the queue', async () => {
    const context = buildService();

    await expect(
      context.service.processFogResponse({
        topic: 'tenant/nvr/videoDevice/config/sub',
        message: JSON.stringify({ msgId: 'msg-1', macAddresses: [] }),
      }),
    ).rejects.toThrow('invalid NVR config topic');

    expect(context.queue.getRepeatableMsg).not.toHaveBeenCalled();
    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(context.serviceProvider.commandBus.execute).not.toHaveBeenCalled();
    expect(context.websocket.sendMessage).not.toHaveBeenCalled();
  });

  it('treats an unknown msgId as a no-op with no side effects', async () => {
    const context = buildService();
    context.queue.getRepeatableMsg.mockResolvedValue(undefined);

    await context.service.processFogResponse({
      topic: 'tenant-id/nvr-id/videoDevice/Config/sub',
      message: JSON.stringify({ msgId: 'unknown-msg', macAddresses: [] }),
    });

    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(context.serviceProvider.queryBus.execute).not.toHaveBeenCalled();
    expect(context.serviceProvider.commandBus.execute).not.toHaveBeenCalled();
    expect(context.websocket.sendMessage).not.toHaveBeenCalled();
  });

  it('rejects unexpected MQTT fields before queue lookup', async () => {
    const context = buildService();

    await expect(
      context.service.processFogResponse({
        topic: 'tenant-id/nvr-id/videoDevice/Config/sub',
        message: JSON.stringify({
          msgId: 'msg-1',
          macAddresses: [],
          status: 'success',
        }),
      }),
    ).rejects.toThrow('property status should not exist');

    expect(context.queue.getRepeatableMsg).not.toHaveBeenCalled();
  });

  it('emits only the sanitized search projection from private camera material', async () => {
    const context = buildService();
    const nvr = NvrEntity.create({
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken: '11111111111111111111111111111111',
      maxCameras: 16,
      password: 'nvr-password',
    });
    nvr.update({ runningConfigs: { search: 'search-msg' } });
    const queued = {
      msgId: 'search-msg',
      nvrId: nvr.id,
      tenantId: nvr.getProps().tenantId,
      configType: NvrConfigs.SEARCH,
      data: {},
      metadata: {
        entityId: nvr.id,
        entityType: VideoDeviceEntityTypes.NVR,
        topic: 'unused',
        retryCount: 2,
        retryPeriodInSecond: 40,
      },
    };
    context.queue.getRepeatableMsg.mockResolvedValue(queued);
    context.cache.get.mockResolvedValue({
      addedCameras: [],
      deletedCameras: [],
    });
    context.serviceProvider.queryBus.execute
      .mockResolvedValueOnce(nvr)
      .mockResolvedValueOnce([]);
    context.sanawApi.getNvrCameraSearchInfo.mockResolvedValue({
      statusCode: 200,
      data: {
        cameras: [
          {
            id: 1,
            cameraAggregateId: '22222222-2222-4222-8222-222222222222',
            serialNumber: 'CAM00001',
            productModel: 'CAM-1',
            username: 'private-user',
            password: 'private-password',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            streams: '{"private":true}',
            port: 554,
            hasPtz: true,
            hasAudio: false,
          },
        ],
      },
    });

    await context.service.processFogResponse({
      topic: `${nvr.getProps().tenantId}/${nvr.id}/videoDevice/Config/sub`,
      message: JSON.stringify({
        msgId: 'search-msg',
        macAddresses: ['AA:BB:CC:DD:EE:FF'],
      }),
    });

    const publicMessage = context.websocket.sendMessage.mock.calls[0]![1];
    expect(publicMessage.data.videoDevices[0].addedCameras).toEqual([
      {
        productModel: 'CAM-1',
        serialNumber: 'CAM00001',
        name: 'Camera CAM00001',
        hasPtz: true,
        hasAudio: false,
      },
    ]);
    expect(JSON.stringify(publicMessage)).not.toMatch(
      /private-user|private-password|AA:BB:CC:DD:EE:FF|"port"|"streams"|requestIndex|"status"/,
    );
    expect(context.cache.set).toHaveBeenCalledWith(
      `autoSearchNvr-${nvr.id}`,
      expect.objectContaining({
        addedCameras: [
          expect.objectContaining({ password: 'private-password' }),
        ],
      }),
      1800,
    );
    expect(context.runningConfigs.doneAndUnlockConfig).toHaveBeenCalledWith(
      nvr,
      NvrConfigs.SEARCH,
      'search-msg',
    );
  });

  it('applies and consumes an owned NVR update acknowledgement', async () => {
    const context = buildService();
    const nvr = NvrEntity.create({
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken: '11111111111111111111111111111111',
      maxCameras: 16,
      password: 'nvr-password',
    });
    nvr.update({ runningConfigs: { update: 'update-msg' } });
    const queued = {
      msgId: 'update-msg',
      nvrId: nvr.id,
      tenantId: nvr.getProps().tenantId,
      configType: NvrConfigs.UPDATE,
      data: { name: 'Updated NVR' },
      metadata: {
        entityId: nvr.id,
        entityType: VideoDeviceEntityTypes.NVR,
        topic: 'unused',
        retryCount: 2,
        retryPeriodInSecond: 10,
        actorProps: { actorId: 'employee-id', actorType: 'EMPLOYEE' },
      },
    };
    context.queue.getRepeatableMsg.mockResolvedValue(queued);
    context.serviceProvider.queryBus.execute.mockResolvedValue(nvr);

    await context.service.processFogResponse({
      topic: `${nvr.getProps().tenantId}/${nvr.id}/videoDevice/Config/sub`,
      message: JSON.stringify({ msgId: 'update-msg' }),
    });

    expect(context.serviceProvider.commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: nvr.id,
        name: 'Updated NVR',
        actorProps: { actorId: 'employee-id', actorType: 'EMPLOYEE' },
      }),
    );
    expect(context.queue.getAndDeleteRepeatableMsg).toHaveBeenCalledWith(
      'update-msg',
    );
    expect(context.runningConfigs.doneAndUnlockConfig).toHaveBeenCalledWith(
      nvr,
      NvrConfigs.UPDATE,
      'update-msg',
    );
  });
});
