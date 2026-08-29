import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TimeseriesQueryBase } from 'src/dddLib/applicationService';
import { CountDataParams } from 'src/dddLib/infra/timeseriesRepository.base';
import { SYSTEM_LOG_REPOSITORY } from 'src/modules/systemLogs/infra/diToken/systemLog.diToken';
import { SystemLogRepository } from 'src/modules/systemLogs/infra/repositories/systemLog.timeseriesRepository';
import {
  SYSTEM_LOG_SUPER_TABLE,
  SystemLogTypes,
  assertSystemLogTenantId,
  assertSystemLogTypes,
} from 'src/modules/systemLogs/domain/systemLog.type';

export class CountAllSystemLogsQuery extends TimeseriesQueryBase {
  tenantId: string;
  types: SystemLogTypes[];
  constructor(
    props: CountDataParams & {
      tenantId: string;
      types: SystemLogTypes[];
    },
  ) {
    super(props);
    assertSystemLogTenantId(props.tenantId);
    assertSystemLogTypes(props.types);
    this.tenantId = props.tenantId;
    this.superTableName = props.superTableName;
    this.subTableName = props.subTableName;
    this.timeRangeInUnix = props.timeRangeInUnix;
    this.types = props.types;
  }
}
@QueryHandler(CountAllSystemLogsQuery)
export class CountAllSystemLogsQueryHandler implements IQueryHandler<CountAllSystemLogsQuery> {
  constructor(
    @Inject(SYSTEM_LOG_REPOSITORY)
    protected readonly systemLogRepo: SystemLogRepository,
  ) {}

  async execute(query: CountAllSystemLogsQuery) {
    query.superTableName = SYSTEM_LOG_SUPER_TABLE;
    const typeFilters: string[] = [];
    if (query?.types.length) {
      for (const type of query.types) {
        typeFilters.push(`groupId='${type}'`);
      }
    }
    query.filter = `tenantId='${query.tenantId}'`;
    if (typeFilters.length > 0) {
      query.filter += ` AND (${typeFilters.join(' OR ')})`;
    }
    const records = await this.systemLogRepo.count(query);
    return records;
  }
}
