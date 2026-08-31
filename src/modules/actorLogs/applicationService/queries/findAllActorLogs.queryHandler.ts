import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ACTOR_LOG_REPOSITORY } from '../../infra/actorLog.diToken';
import { ActorLogRepository } from '../../infra/actorLog.timeseriesRepository';
import {
  assertActorLogIds,
  buildActorLogQueryFilter,
} from '../../infra/actorLogFilter';
import {
  ActorLogTypes,
  assertActorLogTenantId,
  assertActorLogTypes,
  actorLogColumnNames,
  actorLogSuperTableName,
} from '../../domain/actorLog.type';

export class FindAllActorLogsQuery {
  tenantId: string;
  actorTypes?: ActorLogTypes[];
  actorIds?: string[];
  from?: number;
  to?: number;
  constructor(props: {
    tenantId: string;
    actorTypes?: ActorLogTypes[];
    actorIds?: string[];
    from?: number;
    to?: number;
  }) {
    assertActorLogTenantId(props.tenantId);
    if (props.actorTypes) assertActorLogTypes(props.actorTypes);
    assertActorLogIds(props.actorIds);
    this.tenantId = props.tenantId;
    this.actorTypes = props.actorTypes;
    this.actorIds = props.actorIds;
    this.from = props.from;
    this.to = props.to;
  }
}
@QueryHandler(FindAllActorLogsQuery)
export class FindAllActorLogsQueryHandler implements IQueryHandler<FindAllActorLogsQuery> {
  constructor(
    @Inject(ACTOR_LOG_REPOSITORY)
    protected readonly actorLogRepo: ActorLogRepository,
  ) {}

  async execute(query: FindAllActorLogsQuery) {
    return await this.actorLogRepo.findAll({
      superTableName: actorLogSuperTableName(query.tenantId),
      selectedColumns: actorLogColumnNames,
      timeRangeInUnix:
        query.from !== undefined && query.to !== undefined
          ? { start: query.from, end: query.to }
          : undefined,
      filter: buildActorLogQueryFilter({
        tenantId: query.tenantId,
        actorTypes: query.actorTypes,
        actorIds: query.actorIds,
      }),
    });
  }
}
