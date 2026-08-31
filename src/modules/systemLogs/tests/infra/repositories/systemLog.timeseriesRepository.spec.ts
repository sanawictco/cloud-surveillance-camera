import { SystemLogRepository } from '../../../infra/repositories/systemLog.timeseriesRepository';
import {
  SYSTEM_LOG_SUPER_TABLE,
  SystemLogSections,
  SystemLogTypes,
} from '../../../domain/systemLog.type';

jest.mock('configs/app.config', () => ({
  __esModule: true,
  default: () => ({ timeseriesDb: { dbName: 'surveillance' } }),
}));

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

describe('SystemLogRepository', () => {
  it('writes to a server-derived tenant and severity child table', async () => {
    const tdengineClient = { exec: jest.fn().mockResolvedValue(undefined) };
    const repository = new SystemLogRepository(tdengineClient, {
      restUrl: 'http://tdengine:6041',
      token: 'token',
    });

    await repository.insert({
      superTableName: 'caller_controlled_table',
      subTableName: SystemLogTypes.WARNING,
      data: [
        tenantA,
        { key: "device's update failed" },
        SystemLogSections.VIDEO_DEVICES_CONFIG,
        'device-id',
      ],
      createdAt: 1_700_000_000_000,
    });

    const sql = tdengineClient.exec.mock.calls[0][0] as string;
    expect(sql).toContain(
      'surveillance.`system_log_t_11111111111141118111111111111111_warning`',
    );
    expect(sql).toContain(`USING surveillance.${SYSTEM_LOG_SUPER_TABLE}`);
    expect(sql).toContain('(tenantId, groupId)');
    expect(sql).toContain(`'${tenantA}', 'warning'`);
    expect(sql).toContain(
      '(createdAt, messageKey, messageParams, section, entityId)',
    );
    expect(sql).toContain("device''s update failed");
    expect(sql).not.toContain('caller_controlled_table');
  });

  it('deletes records only from the requested tenant child tables', async () => {
    const tdengineClient = { exec: jest.fn().mockResolvedValue(undefined) };
    const repository = new SystemLogRepository(tdengineClient, {
      restUrl: 'http://tdengine:6041',
      token: 'token',
    });
    jest
      .spyOn(repository, 'findAll')
      .mockResolvedValueOnce([[1_700_000_000_000]])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await repository.deleteAll(tenantA, 'device-id');

    expect(repository.findAll).toHaveBeenCalledTimes(3);
    for (const [params] of (repository.findAll as jest.Mock).mock.calls) {
      expect(params.filter).toContain(`tenantId='${tenantA}'`);
      expect(params.filter).toContain("entityId='device-id'");
      expect(params.filter).not.toContain(tenantB);
    }
    expect(tdengineClient.exec).toHaveBeenCalledWith(
      expect.stringContaining(
        'system_log_t_11111111111141118111111111111111_error',
      ),
    );
    expect(tdengineClient.exec).not.toHaveBeenCalledWith(
      expect.stringContaining('system_log_t_22222222222242228222222222222222'),
    );
  });

  it('allocates distinct timestamps for same-millisecond records in one child', async () => {
    const tdengineClient = { exec: jest.fn().mockResolvedValue(undefined) };
    const repository = new SystemLogRepository(tdengineClient, {
      restUrl: 'http://tdengine:6041',
      token: 'token',
    });
    const params = {
      superTableName: SYSTEM_LOG_SUPER_TABLE,
      subTableName: SystemLogTypes.WARNING,
      data: [
        tenantA,
        { key: 'device.update.failed' },
        SystemLogSections.VIDEO_DEVICES_CONFIG,
        'device-id',
      ] as [string, { key: string }, SystemLogSections, string],
      createdAt: 1_700_000_000_000,
    };

    await repository.insert(params);
    await repository.insert(params);

    expect(tdengineClient.exec.mock.calls[0][0]).toContain(
      'VALUES ( 1700000000000,',
    );
    expect(tdengineClient.exec.mock.calls[1][0]).toContain(
      'VALUES ( 1700000000001,',
    );
  });
});
