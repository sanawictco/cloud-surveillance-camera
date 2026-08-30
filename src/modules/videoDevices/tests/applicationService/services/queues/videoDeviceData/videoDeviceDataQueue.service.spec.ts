import { VideoDeviceDataQueueService } from '../../../../../applicationService/services/queues/videoDeviceData/videoDeviceDataQueue.service';
import { CameraHardwareSendCommands } from '../../../../../domain/camera/camera.type';
import { EntityTypes } from '../../../../../shared/valueObjects/entityTypes';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const NVR_A = '33333333-3333-4333-8333-333333333333';
const NVR_B = '44444444-4444-4444-8444-444444444444';
const CAMERA_A = '55555555-5555-4555-8555-555555555555';

describe('VideoDeviceDataQueueService worker', () => {
  function buildService() {
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
    const cameraConfigs = {
      doneAndUnLockConfig: jest.fn().mockResolvedValue(true),
    };
    const cameraSystemLogs = {
      handle: jest.fn().mockResolvedValue(undefined),
    };
    const service = new VideoDeviceDataQueueService(
      mqttService as never,
      serviceProvider as never,
      queue as never,
      cameraConfigs as never,
      cameraSystemLogs as never,
    );
    service.onModuleInit();
    return {
      mqttService,
      queryBus,
      cameraConfigs,
      cameraSystemLogs,
      work: (msg: unknown) => workerHandler(msg),
      expire: (msg: unknown) => expiredHandler(msg),
    };
  }

  function buildJob(overrides: Record<string, any> = {}) {
    const data = {
      msgId: '101',
      configType: CameraHardwareSendCommands.MOVE,
      data: `${CAMERA_A},move,101,1,2`,
      tenantId: TENANT_A,
      nvrId: NVR_A,
      ...overrides,
      metadata: {
        topic: `${NVR_A}/${CAMERA_A}/camera/data/pub`,
        entityId: CAMERA_A,
        entityType: EntityTypes.CAMERA,
        retryCount: 2,
        retryPeriodInSecond: 5,
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

  it('publishes to the topic derived from the validated tenant scope', async () => {
    const context = buildService();

    await context.work(buildJob());

    expect(context.mqttService.publish).toHaveBeenCalledWith(
      `${NVR_A}/${CAMERA_A}/camera/data/pub`,
      `${CAMERA_A},move,101,1,2`,
    );
  });

  it('rejects a job stored under another tenant queue key without publishing', async () => {
    const context = buildService();

    await expect(
      context.work(
        buildJob({ name: `t-${TENANT_B}-n-${NVR_A}-m-101` }),
      ),
    ).rejects.toThrow(/scope is invalid/);
    expect(context.mqttService.publish).not.toHaveBeenCalled();
  });

  it('rejects a job whose stored topic points at another NVR without publishing', async () => {
    const context = buildService();

    await expect(
      context.work(
        buildJob({
          metadata: { topic: `${NVR_B}/${CAMERA_A}/camera/data/pub` },
        }),
      ),
    ).rejects.toThrow(/topic is invalid/);
    expect(context.mqttService.publish).not.toHaveBeenCalled();
  });

  it('rejects an expired job without publishing', async () => {
    const context = buildService();

    await expect(
      context.work(buildJob({ metadata: { expiresAt: Date.now() - 1 } })),
    ).rejects.toThrow(/has expired/);
    expect(context.mqttService.publish).not.toHaveBeenCalled();
  });

  it('rejects an NVR-typed job on the camera-command queue', async () => {
    const context = buildService();

    await expect(
      context.work(
        buildJob({
          metadata: {
            entityType: EntityTypes.NVR,
            entityId: NVR_A,
            topic: `${NVR_A}/${NVR_A}/camera/data/pub`,
          },
        }),
      ),
    ).rejects.toThrow(/entity is invalid/);
    expect(context.mqttService.publish).not.toHaveBeenCalled();
  });

  it('resolves expiry entities with the queue tenant, not an unscoped lookup', async () => {
    const context = buildService();
    const nvr = { id: NVR_A, getProps: () => ({ tenantId: TENANT_A }) };
    const camera = {
      id: CAMERA_A,
      getProps: () => ({ tenantId: TENANT_A, nvrId: NVR_A }),
    };
    context.queryBus.execute
      .mockResolvedValueOnce(nvr)
      .mockResolvedValueOnce(camera);

    await context.expire(buildJob());

    expect(context.queryBus.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tenantId: TENANT_A, id: NVR_A }),
    );
    expect(context.queryBus.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tenantId: TENANT_A, id: CAMERA_A }),
    );
    expect(context.cameraConfigs.doneAndUnLockConfig).toHaveBeenCalledWith(
      camera,
      CameraHardwareSendCommands.MOVE,
      '101',
    );
    expect(context.cameraSystemLogs.handle).toHaveBeenCalled();
  });

  it('fails expiry when the queued camera belongs to another NVR', async () => {
    const context = buildService();
    context.queryBus.execute
      .mockResolvedValueOnce({ id: NVR_A, getProps: () => ({}) })
      .mockResolvedValueOnce({
        id: CAMERA_A,
        getProps: () => ({ tenantId: TENANT_A, nvrId: NVR_B }),
      });

    await expect(context.expire(buildJob())).rejects.toThrow(
      /identity mismatch/,
    );
    expect(context.cameraConfigs.doneAndUnLockConfig).not.toHaveBeenCalled();
  });

  it('does not unlock when the tenant-scoped NVR no longer exists', async () => {
    const context = buildService();
    context.queryBus.execute.mockResolvedValueOnce(undefined);

    await context.expire(buildJob());

    expect(context.cameraConfigs.doneAndUnLockConfig).not.toHaveBeenCalled();
    expect(context.cameraSystemLogs.handle).not.toHaveBeenCalled();
  });
});
