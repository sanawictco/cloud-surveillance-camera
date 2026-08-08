import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TimeseriesQueryBase } from 'src/dddLib/applicationService';
import { SYSTEM_LOG_REPOSITORY } from 'src/modules/systemLogs/infra/diToken/systemLog.diToken';
import { SystemLogRepository } from 'src/modules/systemLogs/infra/repositories/systemLog.timeseriesRepository';
import { SYSTEM_LOG_SUPER_TABLE } from 'src/modules/systemLogs/domain/systemLog.type';

export class FindAllSystemLogsQuery extends TimeseriesQueryBase {}
@QueryHandler(FindAllSystemLogsQuery)
export class FindAllSystemLogsQueryHandler implements IQueryHandler<FindAllSystemLogsQuery> {
  constructor(
    @Inject(SYSTEM_LOG_REPOSITORY)
    protected readonly systemLogRepo: SystemLogRepository,
  ) {}

  async execute(query: FindAllSystemLogsQuery) {
    query.superTableName = SYSTEM_LOG_SUPER_TABLE;
    const records = await this.systemLogRepo.findAll(query);
    return records;
  }
}
