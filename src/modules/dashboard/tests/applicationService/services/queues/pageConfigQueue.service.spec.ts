import { PageConfigQueueService } from '../../../../applicationService/services/queues/pageConfigQueue.service';
import { PageConfigs } from '../../../../domain/page.type';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const NVR_A = '33333333-3333-4333-8333-333333333333';
const PAGE_A = '55555555-5555-4555-8555-555555555555';

function buildJob(overrides: Record<string, any> = {}) {
  const data = {
    msgId: '101',
    configType: PageConfigs.UPDATE_PAGE,
    data: { id: PAGE_A },
    tenantId: TENANT_A,
    nvrId: NVR_A,
    ...overrides,
    metadata: {
      topic: `${TENANT_A}/${NVR_A}/page/config/pub`,
      entityId: PAGE_A,
      entityType: EntityTypes.PAGE,
      retryCount: 3,
      retryPeriodInSecond: 10,
      issuedAt: Date.now() - 1_000,
      expiresAt: Date.now() + 60_000,
      ...(overrides.metadata ?? {}),
    },
  };
  return {
    name: overrides.name ?? `t-${data.tenantId}-n-${data.nvrId}-m-${data.msgId}`,
    data,
    opts: { repeat: { count: 0 } },
    attemptsMade: 1,
  };
}

describe('PageConfigQueueService worker', () => {
  function buildService(queryResults: unknown[] = []) {
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
    const execute = jest.fn();
    for (const result of queryResults) execute.mockResolvedValueOnce(result);
    const runningConfigs = {
      doneAndUnLockConfig: jest.fn().mockResolvedValue(true),
    };
    const systemLogs = { handle: jest.fn().mockResolvedValue(undefined) };
    const service = new PageConfigQueueService(
      mqttService as never,
      {
        queryBus: { execute },
        logger: { debug: jest.fn(), error: jest.fn() },
      } as never,
      queue as never,
      runningConfigs as never,
      systemLogs as never,
    );
    service.onModuleInit();
    return {
      mqttService,
      execute,
      runningConfigs,
      systemLogs,
      work: (msg: unknown) => workerHandler(msg),
      expire: (msg: unknown) => expiredHandler(msg),
    };
  }

  it('publishes to the topic derived from the validated tenant scope', async () => {
    const context = buildService();

    await context.work(buildJob());

    expect(context.mqttService.publish).toHaveBeenCalledWith(
      `${TENANT_A}/${NVR_A}/page/config/pub`,
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

  it('rejects a video-device job that reaches the page queue', async () => {
    const context = buildService();

    await expect(
      context.work(
        buildJob({
          metadata: {
            entityType: EntityTypes.CAMERA,
            topic: `${TENANT_A}/${NVR_A}/page/config/pub`,
          },
        }),
      ),
    ).rejects.toThrow(/entity is invalid/);
    expect(context.mqttService.publish).not.toHaveBeenCalled();
  });

  it('rejects an expired job without publishing', async () => {
    const context = buildService();

    await expect(
      context.work(buildJob({ metadata: { expiresAt: Date.now() - 1 } })),
    ).rejects.toThrow(/has expired/);
    expect(context.mqttService.publish).not.toHaveBeenCalled();
  });

  it('rejects expiry when the queued NVR does not belong to the tenant', async () => {
    const page = { getProps: () => ({ id: PAGE_A, nvrId: NVR_A }) };
    const context = buildService([page, undefined]);

    await expect(context.expire(buildJob())).rejects.toThrow(
      'page queue tenant scope is invalid',
    );
    expect(context.runningConfigs.doneAndUnLockConfig).not.toHaveBeenCalled();
    expect(context.systemLogs.handle).not.toHaveBeenCalled();
  });

  it('resolves the expiring page with the queue tenant and NVR', async () => {
    const page = { getProps: () => ({ id: PAGE_A, nvrId: NVR_A }) };
    const context = buildService([page, { id: NVR_A }]);

    await context.expire(buildJob());

    expect(context.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tenantId: TENANT_A, nvrIds: [NVR_A] }),
    );
    expect(context.runningConfigs.doneAndUnLockConfig).toHaveBeenCalledWith(
      page,
      TENANT_A,
      PageConfigs.UPDATE_PAGE,
      '101',
    );
    expect(context.systemLogs.handle).toHaveBeenCalledWith(TENANT_A, page, {
      configType: PageConfigs.UPDATE_PAGE,
      msgId: '101',
    });
  });
});
