import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ACTOR_LOG_REPOSITORY } from '../../infra/actorLog.diToken';
import { ActorLogRepository } from '../../infra/actorLog.timeseriesRepository';
import { PaginatedTimeseriesQueryBase } from 'src/dddLib/applicationService';
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

export class FindAllPaginatedActorLogsQuery extends PaginatedTimeseriesQueryBase {
  tenantId: string;
  actorTypes?: ActorLogTypes[];
  actorIds?: string[];
  constructor(
    props: { page: number; limit: number } & {
      tenantId: string;
      actorTypes?: ActorLogTypes[];
      actorIds?: string[];
      from?: number;
      to?: number;
    },
  ) {
    assertActorLogTenantId(props.tenantId);
    if (props.actorTypes) assertActorLogTypes(props.actorTypes);
    assertActorLogIds(props.actorIds);
    super({
      superTableName: actorLogSuperTableName(props.tenantId),
      selectedColumns: actorLogColumnNames,
      page: props.page,
      limit: props.limit,
      timeRangeInUnix:
        props.from !== undefined && props.to !== undefined
          ? { start: props.from, end: props.to }
          : undefined,
    });
    this.tenantId = props.tenantId;
    this.actorTypes = props.actorTypes;
    this.actorIds = props.actorIds;
  }
}
@QueryHandler(FindAllPaginatedActorLogsQuery)
export class FindAllPaginatedActorLogsQueryHandler implements IQueryHandler<FindAllPaginatedActorLogsQuery> {
  constructor(
    @Inject(ACTOR_LOG_REPOSITORY)
    protected readonly actorLogRepo: ActorLogRepository,
  ) {}

  async execute(query: FindAllPaginatedActorLogsQuery) {
    // Reads always run against the tenant's own supertable; the tenant and
    // actor predicates are carried by table tags, so TDengine prunes to the
    // matching child tables before scanning. Clients never supply table
    // names or a raw filter.
    query.filter = buildActorLogQueryFilter({
      tenantId: query.tenantId,
      actorTypes: query.actorTypes,
      actorIds: query.actorIds,
    });
    return await this.actorLogRepo.findAllPaginated(query);
  }
}
