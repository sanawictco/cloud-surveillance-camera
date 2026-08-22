import { BadRequestException } from '@nestjs/common';
import { VideoDevicesConfigsMqttController } from '../../controllers/videoDeviceConfigs.mqtt.controller';
import { CameraSoftwareConfigs } from '../../domain/camera/camera.type';
import { NvrConfigs } from '../../domain/nvr/nvr.type';
import { VideoDeviceEntityTypes } from '../../shared/valueObjects/videoDeviceEntityTypes';

describe('VideoDevicesConfigsMqttController', () => {
  function buildController() {
    const nvr = {
      id: 'nvr-id',
      getProps: () => ({ tenantId: 'tenant-id' }),
    };
    const pending = {
      msgId: 'search-msg',
      nvrId: nvr.id,
      tenantId: 'tenant-id',
      configType: NvrConfigs.SEARCH,
      data: {},
      metadata: {
        entityId: nvr.id,
        entityType: VideoDeviceEntityTypes.NVR,
        actorProps: { actorId: 'employee-id', actorType: 'EMPLOYEE' },
      },
    };
    const queue = {
      getRepeatableMsg: jest.fn().mockResolvedValue(pending),
      getAndDeleteRepeatableMsg: jest.fn().mockResolvedValue(pending),
    };
    const nvrMqttService = { search: jest.fn().mockResolvedValue(undefined) };
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

  it('accepts and finalizes an owned camera config', async () => {
    const context = buildController();
    const camera = {
      id: 'camera-id',
      getProps: () => ({ nvrId: context.nvr.id, tenantId: 'tenant-id' }),
    };
    context.pending.msgId = 'camera-msg';
    context.pending.configType = CameraSoftwareConfigs.UPDATE as never;
    context.pending.data = { id: camera.id, name: 'Updated camera' };
    context.pending.metadata.entityId = camera.id;
    context.pending.metadata.entityType = VideoDeviceEntityTypes.CAMERA;
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
      context.pending.msgId = 'camera-msg';
      context.pending.configType = CameraSoftwareConfigs.UPDATE as never;
      context.pending.data = { id: dataId, name: 'Updated camera' };
      context.pending.metadata.entityId = camera.id;
      context.pending.metadata.entityType = VideoDeviceEntityTypes.CAMERA;
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

  it.each([
    {
      name: 'search queue with lifecycle response',
      configType: NvrConfigs.SEARCH,
      entityType: VideoDeviceEntityTypes.NVR,
      message: { msgId: 'mismatch-msg' },
    },
    {
      name: 'register queue with search response',
      configType: NvrConfigs.REGISTER,
      entityType: VideoDeviceEntityTypes.NVR,
      message: { msgId: 'mismatch-msg', macAddresses: [] },
    },
    {
      name: 'live-signal queue with register response',
      configType: NvrConfigs.FOG_LIVE_SIGNAL,
      entityType: VideoDeviceEntityTypes.NVR,
      message: {
        msgId: 'mismatch-msg',
        unRegisteredCameraSerialNumbers: [],
      },
    },
    {
      name: 'NVR lifecycle queue with live-signal response',
      configType: NvrConfigs.UPDATE,
      entityType: VideoDeviceEntityTypes.NVR,
      message: { msgId: 'mismatch-msg', disconnectedMacAddresses: [] },
    },
    {
      name: 'camera lifecycle queue with search response',
      configType: CameraSoftwareConfigs.UPDATE,
      entityType: VideoDeviceEntityTypes.CAMERA,
      message: { msgId: 'mismatch-msg', macAddresses: [] },
    },
  ])('rejects $name before side effects', async (testCase) => {
    const context = buildController();
    context.pending.msgId = 'mismatch-msg';
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
