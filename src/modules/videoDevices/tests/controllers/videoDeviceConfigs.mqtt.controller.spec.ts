import { VideoDevicesConfigsMqttController } from '../../controllers/videoDeviceConfigs.mqtt.controller';
import { NvrConfigs } from '../../domain/nvr/nvr.type';
import { VideoDeviceEntityTypes } from '../../shared/valueObjects/videoDeviceEntityTypes';

describe('VideoDevicesConfigsMqttController', () => {
  function buildController() {
    const nvr = { id: 'nvr-id' };
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
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue(nvr) },
      eventEmitter: { emit: jest.fn() },
    };
    const runningConfigs = {
      doneAndUnlockConfig: jest.fn().mockResolvedValue(true),
    };
    const controller = new VideoDevicesConfigsMqttController(
      queue as never,
      nvrMqttService as never,
      {} as never,
      serviceProvider as never,
      runningConfigs as never,
      {} as never,
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
      runningConfigs,
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
});
