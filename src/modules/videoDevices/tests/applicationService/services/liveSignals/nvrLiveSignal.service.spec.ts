import { NvrLiveSignalService } from '../../../../applicationService/services/liveSignals/nvrLiveSignal.service';
import { NvrConfigs } from '../../../../domain/nvr/nvr.type';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const NVR_A = '33333333-3333-4333-8333-333333333333';

describe('NvrLiveSignalService scheduling', () => {
  function buildService(reReadNvr: unknown) {
    let scheduledHandler!: () => Promise<void>;
    const scheduler = {
      setInterval: jest.fn(
        async (handler: () => Promise<void>, _ms: number, id: string) => {
          scheduledHandler = handler;
          return id;
        },
      ),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const queryBus = { execute: jest.fn().mockResolvedValue(reReadNvr) };
    const runningConfigs = {
      runConfigIfNotDuplicated: jest.fn().mockResolvedValue('101'),
    };
    const service = new NvrLiveSignalService(
      runningConfigs as never,
      { sendTenantMessage: jest.fn() } as never,
      {
        scheduler,
        queryBus,
        commandBus: { execute: jest.fn() },
        logger: { error: jest.fn() },
      } as never,
      {} as never,
    );
    const nvr = { id: NVR_A, getProps: () => ({ tenantId: TENANT_A }) };
    return {
      service,
      scheduler,
      queryBus,
      runningConfigs,
      nvr,
      tick: () => scheduledHandler(),
    };
  }

  it('registers the live-signal interval under a tenant-scoped identifier', async () => {
    const context = buildService(undefined);

    await context.service.start(context.nvr as never);

    expect(context.scheduler.setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      50_000,
      `tenant-${TENANT_A}-nvr-${NVR_A}-live-signal`,
    );
  });

  it('re-reads the NVR under its persisted tenant on every tick', async () => {
    const current = { id: NVR_A, getProps: () => ({ tenantId: TENANT_A }) };
    const context = buildService(current);
    await context.service.start(context.nvr as never);

    await context.tick();

    expect(context.queryBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A, id: NVR_A }),
    );
    expect(context.runningConfigs.runConfigIfNotDuplicated).toHaveBeenCalledWith(
      current,
      NvrConfigs.FOG_LIVE_SIGNAL,
      [],
    );
  });

  it('stops the schedule instead of running a config when the NVR is gone', async () => {
    const context = buildService(undefined);
    await context.service.start(context.nvr as never);

    await context.tick();

    expect(
      context.runningConfigs.runConfigIfNotDuplicated,
    ).not.toHaveBeenCalled();
    expect(context.scheduler.remove).toHaveBeenCalledWith(
      `tenant-${TENANT_A}-nvr-${NVR_A}-live-signal`,
    );
  });

  it('removes both the tenant-scoped and the legacy bare-NVR schedule on stop', async () => {
    const context = buildService(undefined);

    await context.service.stop(context.nvr as never);

    expect(context.scheduler.remove).toHaveBeenCalledWith(
      `tenant-${TENANT_A}-nvr-${NVR_A}-live-signal`,
    );
    expect(context.scheduler.remove).toHaveBeenCalledWith(NVR_A);
  });

  it('does not fail stop when the legacy schedule no longer exists', async () => {
    const context = buildService(undefined);
    context.scheduler.remove
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('unmanaged scheduler'));

    await expect(
      context.service.stop(context.nvr as never),
    ).resolves.toBeUndefined();
  });
});
