import { BadRequestException } from '@nestjs/common';
import { VideoDevicesConfigsMqttController } from '../../controllers/videoDeviceConfigs.mqtt.controller';
import { CameraSoftwareConfigs } from '../../domain/camera/camera.type';
import { NvrConfigs } from '../../domain/nvr/nvr.type';
import { EntityTypes } from '../../shared/valueObjects/entityTypes';

describe('VideoDevicesConfigsMqttController', () => {
  function buildController() {
    const nvr = {
      id: 'nvr-id',
      getProps: () => ({ tenantId: 'tenant-id' }),
    };
    const pending = {
      msgId: '101',
      nvrId: nvr.id,
      tenantId: 'tenant-id',
      configType: NvrConfigs.SEARCH,
      data: {},
      metadata: {
        entityId: nvr.id,
        entityType: EntityTypes.NVR,
        actorProps: { actorId: 'employee-id', actorType: 'EMPLOYEE' },
        issuedAt: Date.now() - 1000,
        expiresAt: Date.now() + 60_000,
        topic: 'tenant-id/nvr-id/videoDevice/Config/pub',
      },
    };
    const queue = {
      getRepeatableMsg: jest.fn().mockResolvedValue(pending),
      getAndDeleteRepeatableMsg: jest.fn().mockResolvedValue(pending),
    };
    const nvrMqttService = { search: jest.fn().mockResolvedValue(undefined) };
    Object.assign(nvrMqttService, {
      update: jest.fn().mockResolvedValue(undefined),
    });
    const cameraMqttService = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue(nvr) },
      eventEmitter: { emit: jest.fn() },
    };
    const runningConfigs = {
      doneAndUnlockConfig: jest.fn().mockResolvedValue(true),
    };
    const cameraRunningConfigs = {
      doneAndUnLockConfig: jest.fn().mockResolvedValue(true),
    };
    const controller = new VideoDevicesConfigsMqttController(
      queue as never,
      nvrMqttService as never,
      cameraMqttService as never,
      serviceProvider as never,
      runningConfigs as never,
      cameraRunningConfigs as never,
    );
    const event = {
      topic: 'tenant-id/nvr-id/videoDevice/Config/sub',
      message: JSON.stringify({
        msgId: pending.msgId,
        macAddresses: [],
      }),
    };
    return {
      controller,
      event,
      nvr,
      pending,
      queue,
      nvrMqttService,
      cameraMqttService,
      runningConfigs,
      cameraRunningConfigs,
      serviceProvider,
    };
  }

  it('consumes and unlocks only after successful processing', async () => {
    const context = buildController();

    await context.controller.handler(context.event);

    expect(context.queue.getAndDeleteRepeatableMsg).toHaveBeenCalledWith(
      'tenant-id',
      context.nvr.id,
      context.pending.msgId,
    );
    expect(context.runningConfigs.doneAndUnlockConfig).toHaveBeenCalledWith(
      context.nvr,
      NvrConfigs.SEARCH,
      context.pending.msgId,
    );
    expect(
      context.nvrMqttService.search.mock.invocationCallOrder[0],
    ).toBeLessThan(
      context.queue.getAndDeleteRepeatableMsg.mock.invocationCallOrder[0]!,
    );
    expect(
      context.queue.getAndDeleteRepeatableMsg.mock.invocationCallOrder[0],
    ).toBeLessThan(
      context.runningConfigs.doneAndUnlockConfig.mock.invocationCallOrder[0]!,
    );
  });

  it('rejects an invalid topic before queue lookup', async () => {
    const context = buildController();
    context.event.topic = 'tenant-id/nvr-id/videoDevice/config/sub';

    await context.controller.handler(context.event);

    expect(context.queue.getRepeatableMsg).not.toHaveBeenCalled();
    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(context.nvrMqttService.search).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(BadRequestException),
    );
  });

  it('reports an unknown msgId without business side effects', async () => {
    const context = buildController();
    context.queue.getRepeatableMsg.mockResolvedValue(undefined);

    await context.controller.handler(context.event);

    expect(context.serviceProvider.queryBus.execute).not.toHaveBeenCalled();
    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(context.nvrMqttService.search).not.toHaveBeenCalled();
    expect(context.runningConfigs.doneAndUnlockConfig).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: 'msg not found' }),
    );
  });

  it('rejects unexpected MQTT fields before queue lookup', async () => {
    const context = buildController();
    context.event.message = JSON.stringify({
      msgId: context.pending.msgId,
      macAddresses: [],
      status: 'success',
    });

    await context.controller.handler(context.event);

    expect(context.queue.getRepeatableMsg).not.toHaveBeenCalled();
    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(context.nvrMqttService.search).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalled();
  });

  it('keeps the queue and lock when processing fails', async () => {
    const context = buildController();
    context.nvrMqttService.search.mockRejectedValue(
      new Error('processing failed'),
    );

    await context.controller.handler(context.event);

    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(context.runningConfigs.doneAndUnlockConfig).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: 'processing failed' }),
    );
  });

  it('keeps the lock when consuming the processed queue message fails', async () => {
    const context = buildController();
    context.queue.getAndDeleteRepeatableMsg.mockResolvedValue(undefined);

    await context.controller.handler(context.event);

    expect(context.nvrMqttService.search).toHaveBeenCalled();
    expect(context.runningConfigs.doneAndUnlockConfig).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        message: 'failed to consume processed config',
      }),
    );
  });

  it('processes a duplicate acknowledgement only once', async () => {
    const context = buildController();
    context.queue.getRepeatableMsg
      .mockResolvedValueOnce(context.pending)
      .mockResolvedValueOnce(undefined);

    await context.controller.handler(context.event);
    await context.controller.handler(context.event);

    expect(context.nvrMqttService.search).toHaveBeenCalledTimes(1);
    expect(context.queue.getAndDeleteRepeatableMsg).toHaveBeenCalledTimes(1);
    expect(context.runningConfigs.doneAndUnlockConfig).toHaveBeenCalledTimes(1);
  });

  it('reports unlock failure after consuming the processed queue message', async () => {
    const context = buildController();
    context.runningConfigs.doneAndUnlockConfig.mockResolvedValue(false);

    await context.controller.handler(context.event);

    expect(context.nvrMqttService.search).toHaveBeenCalled();
    expect(context.queue.getAndDeleteRepeatableMsg).toHaveBeenCalledWith(
      'tenant-id',
      context.nvr.id,
      context.pending.msgId,
    );
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        message: 'failed to unlock processed NVR config',
      }),
    );
  });

  it('accepts and finalizes an owned camera config', async () => {
    const context = buildController();
    const camera = {
      id: 'camera-id',
      getProps: () => ({ nvrId: context.nvr.id, tenantId: 'tenant-id' }),
    };
    context.pending.msgId = '102';
    context.pending.configType = CameraSoftwareConfigs.UPDATE as never;
    context.pending.data = { id: camera.id, name: 'Updated camera' };
    context.pending.metadata.entityId = camera.id;
    context.pending.metadata.entityType = EntityTypes.CAMERA;
    context.event.message = JSON.stringify({ msgId: context.pending.msgId });
    context.serviceProvider.queryBus.execute
      .mockResolvedValueOnce(context.nvr)
      .mockResolvedValueOnce(camera);

    await context.controller.handler(context.event);

    expect(context.cameraMqttService.update).toHaveBeenCalledWith(
      context.pending.data,
      expect.objectContaining({ msgId: context.pending.msgId }),
    );
    expect(context.queue.getAndDeleteRepeatableMsg).toHaveBeenCalledWith(
      'tenant-id',
      context.nvr.id,
      context.pending.msgId,
    );
    expect(
      context.cameraRunningConfigs.doneAndUnLockConfig,
    ).toHaveBeenCalledWith(
      camera,
      CameraSoftwareConfigs.UPDATE,
      context.pending.msgId,
    );
  });

  it('applies and finalizes an owned NVR lifecycle acknowledgement', async () => {
    const context = buildController();
    context.pending.msgId = '103';
    context.pending.configType = NvrConfigs.UPDATE;
    context.pending.data = { id: context.nvr.id, name: 'Updated NVR' };
    context.event.message = JSON.stringify({ msgId: context.pending.msgId });

    await context.controller.handler(context.event);

    expect(context.nvrMqttService.update).toHaveBeenCalledWith(
      context.pending.data,
      expect.objectContaining({
        msgId: context.pending.msgId,
        actorProps: context.pending.metadata.actorProps,
      }),
    );
    expect(context.queue.getAndDeleteRepeatableMsg).toHaveBeenCalledWith(
      'tenant-id',
      context.nvr.id,
      context.pending.msgId,
    );
    expect(context.runningConfigs.doneAndUnlockConfig).toHaveBeenCalledWith(
      context.nvr,
      NvrConfigs.UPDATE,
      context.pending.msgId,
    );
  });

  it.each([
    {
      name: 'another NVR',
      cameraProps: { nvrId: 'another-nvr', tenantId: 'tenant-id' },
      dataId: 'camera-id',
    },
    {
      name: 'another tenant',
      cameraProps: { nvrId: 'nvr-id', tenantId: 'another-tenant' },
      dataId: 'camera-id',
    },
    {
      name: 'another payload entity',
      cameraProps: { nvrId: 'nvr-id', tenantId: 'tenant-id' },
      dataId: 'another-camera',
    },
  ])(
    'rejects a camera config owned by $name',
    async ({ cameraProps, dataId }) => {
      const context = buildController();
      const camera = { id: 'camera-id', getProps: () => cameraProps };
      context.pending.msgId = '102';
      context.pending.configType = CameraSoftwareConfigs.UPDATE as never;
      context.pending.data = { id: dataId, name: 'Updated camera' };
      context.pending.metadata.entityId = camera.id;
      context.pending.metadata.entityType = EntityTypes.CAMERA;
      context.event.message = JSON.stringify({ msgId: context.pending.msgId });
      context.serviceProvider.queryBus.execute
        .mockResolvedValueOnce(context.nvr)
        .mockResolvedValueOnce(camera);

      await context.controller.handler(context.event);

      expect(context.cameraMqttService.update).not.toHaveBeenCalled();
      expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
      expect(
        context.cameraRunningConfigs.doneAndUnLockConfig,
      ).not.toHaveBeenCalled();
      expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(BadRequestException),
      );
    },
  );

  it('rejects an NVR config with another entity id', async () => {
    const context = buildController();
    context.pending.metadata.entityId = 'another-nvr';

    await context.controller.handler(context.event);

    expect(context.nvrMqttService.search).not.toHaveBeenCalled();
    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(context.runningConfigs.doneAndUnlockConfig).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(BadRequestException),
    );
  });

  it('rejects an expired queued config before business side effects', async () => {
    const context = buildController();
    context.pending.metadata.expiresAt = Date.now() - 1;

    await context.controller.handler(context.event);

    expect(context.nvrMqttService.search).not.toHaveBeenCalled();
    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(BadRequestException),
    );
  });

  it.each([
    {
      name: 'search queue with lifecycle response',
      configType: NvrConfigs.SEARCH,
      entityType: EntityTypes.NVR,
      message: { msgId: '104' },
    },
    {
      name: 'register queue with search response',
      configType: NvrConfigs.REGISTER,
      entityType: EntityTypes.NVR,
      message: { msgId: '104', macAddresses: [] },
    },
    {
      name: 'live-signal queue with register response',
      configType: NvrConfigs.FOG_LIVE_SIGNAL,
      entityType: EntityTypes.NVR,
      message: {
        msgId: '104',
        unRegisteredCameraSerialNumbers: [],
      },
    },
    {
      name: 'NVR lifecycle queue with live-signal response',
      configType: NvrConfigs.UPDATE,
      entityType: EntityTypes.NVR,
      message: { msgId: '104', disconnectedMacAddresses: [] },
    },
    {
      name: 'camera lifecycle queue with search response',
      configType: CameraSoftwareConfigs.UPDATE,
      entityType: EntityTypes.CAMERA,
      message: { msgId: '104', macAddresses: [] },
    },
  ])('rejects $name before side effects', async (testCase) => {
    const context = buildController();
    context.pending.msgId = '104';
    context.pending.configType = testCase.configType as never;
    context.pending.metadata.entityType = testCase.entityType;
    context.event.message = JSON.stringify(testCase.message);

    await context.controller.handler(context.event);

    expect(context.serviceProvider.queryBus.execute).not.toHaveBeenCalled();
    expect(context.nvrMqttService.search).not.toHaveBeenCalled();
    expect(context.cameraMqttService.update).not.toHaveBeenCalled();
    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(context.runningConfigs.doneAndUnlockConfig).not.toHaveBeenCalled();
    expect(
      context.cameraRunningConfigs.doneAndUnLockConfig,
    ).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(BadRequestException),
    );
  });
});
