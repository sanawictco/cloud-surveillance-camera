import {
  CountAllSystemLogsQuery,
  CountAllSystemLogsQueryHandler,
} from '../../../../applicationService/queries/systemLog/countAllSystemLogs.queryHandler';
import {
  FindAllPaginatedSystemLogsQuery,
  FindAllPaginatedSystemLogsQueryHandler,
} from '../../../../applicationService/queries/systemLog/findAllPaginatedSystemLogs.queryHandler';
import {
  SystemLogTypes,
  systemLogSelectedColumns,
  systemLogSuperTableName,
} from '../../../../domain/systemLog.type';

const tenantId = '11111111-1111-4111-8111-111111111111';
const tenantStableName = systemLogSuperTableName(tenantId);

describe('System log tenant queries', () => {
  it('scopes paginated records and their implicit count to one tenant', async () => {
    const repository = {
      ensureSuperTable: jest.fn().mockResolvedValue(undefined),
      findAllPaginated: jest.fn().mockResolvedValue({
        totalDocs: 0,
        page: 1,
        limit: 10,
        docs: [],
      }),
    };
    const handler = new FindAllPaginatedSystemLogsQueryHandler(
      repository as never,
    );

    await handler.execute(
      new FindAllPaginatedSystemLogsQuery({
        tenantId,
        types: [SystemLogTypes.WARNING, SystemLogTypes.ERROR],
        page: 1,
        limit: 10,
      }),
    );

    expect(repository.ensureSuperTable).toHaveBeenCalledWith(tenantId);
    expect(repository.findAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        superTableName: tenantStableName,
        selectedColumns: systemLogSelectedColumns,
        filter: `tenantId='${tenantId}' AND (groupId='warning' OR groupId='error')`,
      }),
    );
  });

  it('scopes explicit counts to one tenant', async () => {
    const repository = {
      ensureSuperTable: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(2),
    };
    const handler = new CountAllSystemLogsQueryHandler(repository as never);

    await expect(
      handler.execute(
        new CountAllSystemLogsQuery({
          tenantId,
          types: [SystemLogTypes.INFORMATION],
        }),
      ),
    ).resolves.toBe(2);
    expect(repository.ensureSuperTable).toHaveBeenCalledWith(tenantId);
    expect(repository.count).toHaveBeenCalledWith(
      expect.objectContaining({
        superTableName: tenantStableName,
        filter: `tenantId='${tenantId}' AND (groupId='information')`,
      }),
    );
  });

  it('rejects unknown severity values before building a filter', () => {
    expect(
      () =>
        new FindAllPaginatedSystemLogsQuery({
          tenantId,
          types: ["warning' OR 1=1 --" as SystemLogTypes],
          page: 1,
          limit: 10,
        }),
    ).toThrow('system log type is invalid');
  });
});
