import { VideoDeviceConfigQueueService } from '../../../../../applicationService/services/queues/videoDeviceConfig/videoDeviceQueue.service';
import { NvrConfigs } from '../../../../../domain/nvr/nvr.type';
import { EntityTypes } from '../../../../../shared/valueObjects/entityTypes';

describe('VideoDeviceConfigQueueService', () => {
  function buildService(unlocked: boolean) {
    let expiredHandler: (message: unknown) => Promise<void>;
    const queue = {
      createQueue: jest.fn(
        (
          _name: string,
          _worker: (message: unknown) => Promise<void>,
          expired: (message: unknown) => Promise<void>,
        ) => {
          expiredHandler = expired;
        },
      ),
    };
    const nvr = {
      id: 'nvr-id',
      getProps: () => ({ tenantId: 'tenant-id' }),
    };
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue(nvr) },
      userInfoService: { getProps: jest.fn() },
      logger: { debug: jest.fn() },
    };
    const runningConfigs = {
      doneAndUnlockConfig: jest.fn().mockResolvedValue(unlocked),
    };
    const systemLogs = { handle: jest.fn().mockResolvedValue(undefined) };
    const service = new VideoDeviceConfigQueueService(
      {} as never,
      serviceProvider as never,
      queue as never,
      runningConfigs as never,
      {} as never,
      systemLogs as never,
      {} as never,
    );
    service.onModuleInit();
    const message = {
      data: {
        msgId: '101',
        tenantId: 'tenant-id',
        nvrId: nvr.id,
        configType: NvrConfigs.SEARCH,
        metadata: {
          entityId: nvr.id,
          entityType: EntityTypes.NVR,
        },
      },
    };
    return {
      message,
      nvr,
      runningConfigs,
      systemLogs,
      expire: () => expiredHandler!(message),
    };
  }

  it('logs terminal failure after exact operation unlock succeeds', async () => {
    const context = buildService(true);

    await context.expire();

    expect(context.runningConfigs.doneAndUnlockConfig).toHaveBeenCalledWith(
      context.nvr,
      NvrConfigs.SEARCH,
      '101',
    );
    expect(context.systemLogs.handle).toHaveBeenCalledWith(context.nvr, {
      configType: NvrConfigs.SEARCH,
      msgId: '101',
    });
  });

  it('does not log failure when expiry no longer owns the operation', async () => {
    const context = buildService(false);

    await context.expire();

    expect(context.systemLogs.handle).not.toHaveBeenCalled();
  });

  it('regenerates an active collision and stores the scoped queue key', async () => {
    const queue = {
      getMsg: jest
        .fn()
        .mockResolvedValueOnce({ msgId: '101' })
        .mockResolvedValueOnce(undefined),
      addMsg: jest.fn().mockResolvedValue(undefined),
    };
    const service = new VideoDeviceConfigQueueService(
      {} as never,
      {
        userInfoService: { getProps: jest.fn() },
        logger: { debug: jest.fn() },
      } as never,
      queue as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const message = {
      msgId: '101',
      tenantId: 'tenant-id',
      nvrId: 'nvr-id',
      configType: NvrConfigs.SEARCH,
      data: {},
      metadata: {
        topic: 'tenant-id/nvr-id/videoDevice/Config/pub',
        entityId: 'nvr-id',
        entityType: EntityTypes.NVR,
        retryCount: 2,
        retryPeriodInSecond: 10,
      },
    };

    const allocated = await service.addRepeatableMsg(message);

    expect(allocated).not.toBe('101');
    expect(queue.getMsg).toHaveBeenNthCalledWith(
      1,
      't-tenant-id-n-nvr-id-m-101',
    );
    expect(queue.addMsg).toHaveBeenCalledWith(
      expect.objectContaining({ msgId: allocated }),
      expect.objectContaining({
        msgId: `t-tenant-id-n-nvr-id-m-${allocated}`,
      }),
    );
    expect(message.metadata.issuedAt).toEqual(expect.any(Number));
    expect(message.metadata.expiresAt).toBeGreaterThan(
      message.metadata.issuedAt!,
    );
  });
});
