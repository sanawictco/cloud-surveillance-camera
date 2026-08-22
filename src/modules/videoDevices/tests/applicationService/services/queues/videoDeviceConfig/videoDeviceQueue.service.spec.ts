import { VideoDeviceConfigQueueService } from '../../../../../applicationService/services/queues/videoDeviceConfig/videoDeviceQueue.service';
import { NvrConfigs } from '../../../../../domain/nvr/nvr.type';
import { VideoDeviceEntityTypes } from '../../../../../shared/valueObjects/videoDeviceEntityTypes';

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
    const nvr = { id: 'nvr-id' };
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
        msgId: 'search-msg',
        configType: NvrConfigs.SEARCH,
        metadata: {
          entityId: nvr.id,
          entityType: VideoDeviceEntityTypes.NVR,
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
      'search-msg',
    );
    expect(context.systemLogs.handle).toHaveBeenCalledWith(context.nvr, {
      configType: NvrConfigs.SEARCH,
      msgId: 'search-msg',
    });
  });

  it('does not log failure when expiry no longer owns the operation', async () => {
    const context = buildService(false);

    await context.expire();

    expect(context.systemLogs.handle).not.toHaveBeenCalled();
  });
});
