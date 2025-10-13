import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ACTOR_LOG_REPOSITORY } from '../../infra/actorLog.diToken';
import { ActorLogRepository } from '../../infra/actorLog.timeseriesRepository';
import { PaginatedTimeseriesQueryBase } from 'src/dddLib/applicationService';
import {
  actorLogColumnNames,
  SANAW_KIOSK_USER_ID,
} from '../../domain/actorLog.type';

export class FindAllPaginatedActorLogsQuery extends PaginatedTimeseriesQueryBase {}
@QueryHandler(FindAllPaginatedActorLogsQuery)
export class FindAllPaginatedActorLogsQueryHandler
  implements IQueryHandler<FindAllPaginatedActorLogsQuery>
{
  constructor(
    @Inject(ACTOR_LOG_REPOSITORY)
    protected readonly actorLogRepo: ActorLogRepository,
  ) {}

  async execute(query: FindAllPaginatedActorLogsQuery) {
    if (!query.selectedColumns) query.selectedColumns = actorLogColumnNames;
    let _subTableName;
    if (query.subTableName && query.subTableName === SANAW_KIOSK_USER_ID)
      _subTableName = query.subTableName;
    else if (query.subTableName) {
      _subTableName = query.subTableName + '-actorLog';
    }
    const records = await this.actorLogRepo.findAllPaginated({
      ...query,
      subTableName: _subTableName,
    });
    return records;
  }
}
