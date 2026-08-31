import { VideoDeviceConfigQueueService } from '../../../../../applicationService/services/queues/videoDeviceConfig/videoDeviceQueue.service';
import { NvrConfigs } from '../../../../../domain/nvr/nvr.type';
import { EntityTypes } from '../../../../../shared/valueObjects/entityTypes';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const NVR_A = '33333333-3333-4333-8333-333333333333';
const NVR_B = '44444444-4444-4444-8444-444444444444';
const CAMERA_A = '55555555-5555-4555-8555-555555555555';

function buildJob(overrides: Record<string, any> = {}) {
  const data = {
    msgId: '101',
    configType: NvrConfigs.SEARCH,
    data: {},
    tenantId: TENANT_A,
    nvrId: NVR_A,
    ...overrides,
    metadata: {
      topic: `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-fog`,
      entityId: NVR_A,
      entityType: EntityTypes.NVR,
      retryCount: 2,
      retryPeriodInSecond: 10,
      issuedAt: Date.now() - 1_000,
      expiresAt: Date.now() + 60_000,
      ...(overrides.metadata ?? {}),
    },
  };
  return {
    name:
      overrides.name ?? `t-${data.tenantId}-n-${data.nvrId}-m-${data.msgId}`,
    data,
    opts: { repeat: { count: 0 } },
    attemptsMade: 1,
  };
}

describe('VideoDeviceConfigQueueService', () => {
  function buildService(unlocked = true) {
    let workerHandler!: (message: unknown) => Promise<void>;
    let expiredHandler!: (message: unknown) => Promise<void>;
    const queue = {
      createQueue: jest.fn(
        (
          _name: string,
          worker: (message: unknown) => Promise<void>,
          expired: (message: unknown) => Promise<void>,
        ) => {
          workerHandler = worker;
          expiredHandler = expired;
        },
      ),
    };
    const mqttService = { publish: jest.fn().mockResolvedValue(undefined) };
    const queryBus = { execute: jest.fn() };
    const serviceProvider = {
      queryBus,
      userInfoService: { getProps: jest.fn() },
      logger: { debug: jest.fn(), error: jest.fn() },
    };
    const nvrRunningConfigs = {
      doneAndUnlockConfig: jest.fn().mockResolvedValue(unlocked),
    };
    const cameraRunningConfigs = {
      doneAndUnLockConfig: jest.fn().mockResolvedValue(unlocked),
    };
    const nvrSystemLogs = { handle: jest.fn().mockResolvedValue(undefined) };
    const cameraSystemLogs = { handle: jest.fn().mockResolvedValue(undefined) };
    const service = new VideoDeviceConfigQueueService(
      mqttService as never,
      serviceProvider as never,
      queue as never,
      nvrRunningConfigs as never,
      cameraRunningConfigs as never,
      nvrSystemLogs as never,
      cameraSystemLogs as never,
    );
    service.onModuleInit();
    return {
      mqttService,
      queryBus,
      nvrRunningConfigs,
      cameraRunningConfigs,
      nvrSystemLogs,
      cameraSystemLogs,
      work: (msg: unknown) => workerHandler(msg),
      expire: (msg: unknown) => expiredHandler(msg),
    };
  }

  it('publishes to the topic derived from the validated tenant scope', async () => {
    const context = buildService();

    await context.work(buildJob());

    expect(context.mqttService.publish).toHaveBeenCalledTimes(1);
    expect(context.mqttService.publish).toHaveBeenCalledWith(
      `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-fog`,
      '101',
    );
  });

  it('rejects a job stored under another tenant queue key without publishing', async () => {
    const context = buildService();

    await expect(
      context.work(buildJob({ name: `t-${TENANT_B}-n-${NVR_A}-m-101` })),
    ).rejects.toThrow(/scope is invalid/);
    expect(context.mqttService.publish).not.toHaveBeenCalled();
  });

  it('rejects a job whose stored topic names another tenant without publishing', async () => {
    const context = buildService();

    await expect(
      context.work(
        buildJob({
          metadata: {
            topic: `tenants/${TENANT_B}/nvrs/${NVR_A}/config/to-fog`,
          },
        }),
      ),
    ).rejects.toThrow(/topic is invalid/);
    expect(context.mqttService.publish).not.toHaveBeenCalled();
  });

  it('rejects a job with no lifetime stamped without publishing', async () => {
    const context = buildService();

    await expect(
      context.work(
        buildJob({ metadata: { issuedAt: undefined, expiresAt: undefined } }),
      ),
    ).rejects.toThrow(/lifetime is invalid/);
    expect(context.mqttService.publish).not.toHaveBeenCalled();
  });

  it('logs terminal failure after exact operation unlock succeeds', async () => {
    const context = buildService(true);
    const nvr = { id: NVR_A, getProps: () => ({ tenantId: TENANT_A }) };
    context.queryBus.execute.mockResolvedValue(nvr);

    await context.expire(buildJob());

    expect(context.queryBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A, id: NVR_A }),
    );
    expect(context.nvrRunningConfigs.doneAndUnlockConfig).toHaveBeenCalledWith(
      nvr,
      NvrConfigs.SEARCH,
      '101',
    );
    expect(context.nvrSystemLogs.handle).toHaveBeenCalledWith(nvr, {
      configType: NvrConfigs.SEARCH,
      msgId: '101',
    });
  });

  it('does not log failure when expiry no longer owns the operation', async () => {
    const context = buildService(false);
    context.queryBus.execute.mockResolvedValue({
      id: NVR_A,
      getProps: () => ({ tenantId: TENANT_A }),
    });

    await context.expire(buildJob());

    expect(context.nvrSystemLogs.handle).not.toHaveBeenCalled();
  });

  it('rejects an NVR-typed job whose entity is not the queued NVR', async () => {
    const context = buildService();

    await expect(
      context.expire(buildJob({ metadata: { entityId: NVR_B } })),
    ).rejects.toThrow(/identity mismatch/);
    expect(
      context.nvrRunningConfigs.doneAndUnlockConfig,
    ).not.toHaveBeenCalled();
  });

  it('rejects expiry when the queued camera belongs to another NVR', async () => {
    const context = buildService();
    context.queryBus.execute.mockResolvedValue({
      id: CAMERA_A,
      getProps: () => ({ tenantId: TENANT_A, nvrId: NVR_B }),
    });

    await expect(
      context.expire(
        buildJob({
          configType: 'update',
          metadata: {
            entityId: CAMERA_A,
            entityType: EntityTypes.CAMERA,
          },
        }),
      ),
    ).rejects.toThrow(/identity mismatch/);
    expect(
      context.cameraRunningConfigs.doneAndUnLockConfig,
    ).not.toHaveBeenCalled();
  });

  it('resolves the expiring camera with the queue tenant', async () => {
    const context = buildService(true);
    const camera = {
      id: CAMERA_A,
      getProps: () => ({ tenantId: TENANT_A, nvrId: NVR_A }),
    };
    context.queryBus.execute.mockResolvedValue(camera);

    await context.expire(
      buildJob({
        configType: 'update',
        metadata: { entityId: CAMERA_A, entityType: EntityTypes.CAMERA },
      }),
    );

    expect(context.queryBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A, id: CAMERA_A }),
    );
    expect(context.cameraSystemLogs.handle).toHaveBeenCalled();
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
        logger: { debug: jest.fn(), error: jest.fn() },
      } as never,
      queue as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const message = buildJob().data;

    const allocated = await service.addRepeatableMsg(message as never);

    expect(allocated).not.toBe('101');
    expect(queue.getMsg).toHaveBeenNthCalledWith(
      1,
      `t-${TENANT_A}-n-${NVR_A}-m-101`,
    );
    expect(queue.addMsg).toHaveBeenCalledWith(
      expect.objectContaining({ msgId: allocated }),
      expect.objectContaining({
        msgId: `t-${TENANT_A}-n-${NVR_A}-m-${allocated}`,
      }),
    );
    expect(message.metadata.issuedAt).toEqual(expect.any(Number));
    expect(message.metadata.expiresAt).toBeGreaterThan(
      message.metadata.issuedAt!,
    );
  });
});
