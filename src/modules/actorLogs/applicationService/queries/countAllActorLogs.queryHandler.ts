import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ACTOR_LOG_REPOSITORY } from '../../infra/actorLog.diToken';
import { ActorLogRepository } from '../../infra/actorLog.timeseriesRepository';
import { TimeseriesQueryBase } from 'src/dddLib/applicationService';
import { CountDataParams } from 'src/dddLib/infra/timeseriesRepository.base';
import { SANAW_KIOSK_USER_ID } from '../../domain/actorLog.type';

export class CountAllActorLogsQuery extends TimeseriesQueryBase {
  constructor(props: CountDataParams) {
    super(props);
    this.superTableName = props.superTableName;
    this.subTableName = props.subTableName;
    this.timeRangeInUnix = props.timeRangeInUnix;
  }
}
@QueryHandler(CountAllActorLogsQuery)
export class CountAllActorLogsQueryHandler
  implements IQueryHandler<CountAllActorLogsQuery>
{
  constructor(
    @Inject(ACTOR_LOG_REPOSITORY)
    protected readonly actorLogRepo: ActorLogRepository,
  ) {}

  async execute(query: CountAllActorLogsQuery) {
    let _subTableName;
    if (query.subTableName && query.subTableName === SANAW_KIOSK_USER_ID)
      _subTableName = query.subTableName;
    else if (query.subTableName) {
      _subTableName = query.subTableName + '-actorLog';
    }
    const records = await this.actorLogRepo.count({
      ...query,
      subTableName: _subTableName,
    });
    return records;
  }
}
