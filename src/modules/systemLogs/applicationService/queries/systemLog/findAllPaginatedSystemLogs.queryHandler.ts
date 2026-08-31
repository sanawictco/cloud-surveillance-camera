import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PaginatedTimeseriesQueryBase } from 'src/dddLib/applicationService';
import { Paginated } from 'src/dddLib/infra';
import { SYSTEM_LOG_REPOSITORY } from 'src/modules/systemLogs/infra/diToken/systemLog.diToken';
import { SystemLogRepository } from 'src/modules/systemLogs/infra/repositories/systemLog.timeseriesRepository';
import {
  SYSTEM_LOG_SUPER_TABLE,
  SystemLogTypes,
  assertSystemLogTenantId,
  assertSystemLogTypes,
  systemLogSelectedColumns,
} from 'src/modules/systemLogs/domain/systemLog.type';
import { FindDataParams } from 'src/dddLib/infra/timeseriesRepository.base';
import { TimeSeriesDbExtension } from 'src/dddLib/utils/timeSeriesDbExtension';

export class FindAllPaginatedSystemLogsQuery extends PaginatedTimeseriesQueryBase {
  tenantId: string;
  types: SystemLogTypes[];
  constructor(
    props: FindDataParams & { page: number; limit: number } & {
      tenantId: string;
      types: SystemLogTypes[];
    },
  ) {
    super(props);
    assertSystemLogTenantId(props.tenantId);
    assertSystemLogTypes(props.types);
    this.tenantId = props.tenantId;
    this.types = props.types;
  }
}
@QueryHandler(FindAllPaginatedSystemLogsQuery)
export class FindAllPaginatedSystemLogsQueryHandler implements IQueryHandler<FindAllPaginatedSystemLogsQuery> {
  constructor(
    @Inject(SYSTEM_LOG_REPOSITORY)
    protected readonly systemLogRepo: SystemLogRepository,
  ) {}

  async execute(
    query: FindAllPaginatedSystemLogsQuery,
  ): Promise<Paginated<any>> {
    query.superTableName = SYSTEM_LOG_SUPER_TABLE;
    query.selectedColumns = systemLogSelectedColumns;
    const typeFilters: string[] = [];
    if (query?.types.length) {
      for (const type of query.types) {
        typeFilters.push(
          `groupId=${TimeSeriesDbExtension.quoteStringLiteral(type)}`,
        );
      }
    }
    query.filter = `tenantId=${TimeSeriesDbExtension.quoteStringLiteral(query.tenantId)}`;
    if (typeFilters.length > 0) {
      query.filter += ` AND (${typeFilters.join(' OR ')})`;
    }

    const records = await this.systemLogRepo.findAllPaginated(query);
    return records;
  }
}
