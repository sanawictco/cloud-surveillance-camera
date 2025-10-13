import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TimeseriesQueryBase } from 'src/dddLib/applicationService';
import { CountDataParams } from 'src/dddLib/infra/timeseriesRepository.base';
import { SYSTEM_LOG_REPOSITORY } from 'src/modules/systemLogs/infra/diToken/systemLog.diToken';
import { SystemLogRepository } from 'src/modules/systemLogs/infra/repositories/systemLog.timeseriesRepository';
import {
  SYSTEM_LOG_SUPER_TABLE,
  SystemLogTypes,
} from 'src/modules/systemLogs/domain/systemLog.type';

export class CountAllSystemLogsQuery extends TimeseriesQueryBase {
  types: SystemLogTypes[];
  constructor(props: CountDataParams & { types: SystemLogTypes[] }) {
    super(props);
    this.superTableName = props.superTableName;
    this.subTableName = props.subTableName;
    this.timeRangeInUnix = props.timeRangeInUnix;
    this.types = props.types;
  }
}
@QueryHandler(CountAllSystemLogsQuery)
export class CountAllSystemLogsQueryHandler
  implements IQueryHandler<CountAllSystemLogsQuery>
{
  constructor(
    @Inject(SYSTEM_LOG_REPOSITORY)
    protected readonly systemLogRepo: SystemLogRepository,
  ) {}

  async execute(query: CountAllSystemLogsQuery) {
    query.superTableName = SYSTEM_LOG_SUPER_TABLE;
    if (query?.types.length) {
      const _filterOptions: string[] = [];
      for (const type of query.types) {
        _filterOptions.push('groupId=' + `'${type}'`);
      }
      query.filter = _filterOptions.join(' OR ');
    }
    const records = await this.systemLogRepo.count(query);
    return records;
  }
}
