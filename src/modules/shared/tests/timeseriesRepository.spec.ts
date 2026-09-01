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
  it('performs no schema DDL at boot — tenant supertables are ensured by repositories on first write', async () => {
    const tdengineClient = {
      exec: jest.fn().mockResolvedValue(undefined),
    };
    const repository = new TimeseriesRepository(tdengineClient, {
      restUrl: 'http://tdengine:6041',
      token: 'token',
    });

    // Constructing the shared base must not create any table; system-log and
    // actor-log supertables are per-tenant and are ensured by their
    // repositories on each tenant's first write.
    expect(tdengineClient.exec).not.toHaveBeenCalled();
  });
});
