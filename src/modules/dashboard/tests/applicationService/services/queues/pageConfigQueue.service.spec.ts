import { PageConfigQueueService } from '../../../../applicationService/services/queues/pageConfigQueue.service';
import { PageConfigs } from '../../../../domain/page.type';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';

describe('PageConfigQueueService', () => {
  it('rejects expiry when the queued NVR does not belong to the tenant', async () => {
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
    const page = {
      getProps: () => ({ id: 'page-id', nvrId: 'nvr-id' }),
    };
    const queryBus = {
      execute: jest
        .fn()
        .mockResolvedValueOnce(page)
        .mockResolvedValueOnce(undefined),
    };
    const runningConfigs = { doneAndUnLockConfig: jest.fn() };
    const systemLogs = { handle: jest.fn() };
    const service = new PageConfigQueueService(
      {} as never,
      { queryBus, logger: { debug: jest.fn() } } as never,
      queue as never,
      runningConfigs as never,
      systemLogs as never,
    );
    service.onModuleInit();

    await expect(
      expiredHandler!({
        data: {
          msgId: '101',
          tenantId: 'tenant-a',
          nvrId: 'nvr-id',
          configType: PageConfigs.UPDATE_PAGE,
          metadata: {
            entityId: 'page-id',
            entityType: EntityTypes.PAGE,
          },
        },
      }),
    ).rejects.toThrow('page queue tenant scope is invalid');
    expect(runningConfigs.doneAndUnLockConfig).not.toHaveBeenCalled();
    expect(systemLogs.handle).not.toHaveBeenCalled();
  });
});
