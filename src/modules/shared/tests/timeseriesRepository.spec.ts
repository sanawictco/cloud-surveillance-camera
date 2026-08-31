import { TimeseriesRepository } from '../timeseriesRepository';

jest.mock('configs/app.config', () => ({
  __esModule: true,
  default: () => ({
    timeseriesDb: {
      dbName: 'surveillance',
    },
  }),
}));

describe('TimeseriesRepository', () => {
  it('initializes the tenant-tagged system log supertable', async () => {
    const tdengineClient = {
      exec: jest.fn().mockResolvedValue(undefined),
    };
    const repository = new TimeseriesRepository(tdengineClient, {
      restUrl: 'http://tdengine:6041',
      token: 'token',
    });

    await repository.initSuperTables();

    expect(tdengineClient.exec).toHaveBeenCalledWith(
      expect.stringContaining('CREATE STABLE IF NOT EXISTS systemLogDetailV2'),
    );
    expect(tdengineClient.exec).toHaveBeenCalledWith(
      expect.stringContaining(
        'TAGS (tenantId VARCHAR(36),groupId VARCHAR(15))',
      ),
    );
  });

  it('creates no actor log supertable at boot', async () => {
    const tdengineClient = {
      exec: jest.fn().mockResolvedValue(undefined),
    };
    const repository = new TimeseriesRepository(tdengineClient, {
      restUrl: 'http://tdengine:6041',
      token: 'token',
    });

    await repository.initSuperTables();

    // Actor-log supertables are per-tenant (actor_log_t_<tenant>) and are
    // ensured by ActorLogRepository on each tenant's first write instead.
    expect(
      tdengineClient.exec.mock.calls.some(([sql]: [string]) =>
        sql.includes('actor_log'),
      ),
    ).toBe(false);
  });
});
