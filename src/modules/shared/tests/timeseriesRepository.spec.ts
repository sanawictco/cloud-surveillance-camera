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
  it('initializes actor and system log supertables', async () => {
    const tdengineClient = {
      exec: jest.fn().mockResolvedValue(undefined),
    };
    const repository = new TimeseriesRepository(tdengineClient, {
      restUrl: 'http://tdengine:6041',
      token: 'token',
    });

    await repository.initSuperTables();

    expect(tdengineClient.exec).toHaveBeenCalledWith(
      expect.stringContaining('CREATE STABLE IF NOT EXISTS actorLogSuperTable'),
    );
    expect(tdengineClient.exec).toHaveBeenCalledWith(
      expect.stringContaining(
        'CREATE STABLE IF NOT EXISTS systemLogSuperTable',
      ),
    );
  });
});
