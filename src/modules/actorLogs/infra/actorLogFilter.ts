import { ArgumentInvalidException } from 'src/dddLib/core/exceptions';
import { Guard } from 'src/dddLib/utils';
import { TimeSeriesDbExtension } from 'src/dddLib/utils/timeSeriesDbExtension';
import {
  ACTOR_LOG_ACTOR_ID_COLUMN_SIZE,
  ActorLogTypes,
} from '../domain/actorLog.type';

export interface ActorLogQueryScope {
  tenantId: string;
  actorTypes?: ActorLogTypes[];
  actorIds?: string[];
}

/** Length-validates optional actor id filters, failing closed. */
export function assertActorLogIds(actorIds: string[] | undefined): void {
  if (!actorIds) return;
  for (const actorId of actorIds) {
    if (!Guard.isBetween(actorId, 1, ACTOR_LOG_ACTOR_ID_COLUMN_SIZE)) {
      throw new ArgumentInvalidException('invalid actor log actorId');
    }
  }
}

/**
 * Builds the WHERE clause for tenant-scoped actor-log reads. Every value is
 * validated and passed through the central SQL literal escaper; callers never
 * supply raw SQL fragments.
 */
export function buildActorLogQueryFilter(scope: ActorLogQueryScope): string {
  assertActorLogIds(scope.actorIds);
  const clauses: string[] = [
    `tenantId=${TimeSeriesDbExtension.quoteStringLiteral(scope.tenantId)}`,
  ];
  if (scope.actorTypes?.length) {
    const typeFilters = scope.actorTypes.map((type) =>
      TimeSeriesDbExtension.quoteStringLiteral(type),
    );
    clauses.push(`(actorLogType=${typeFilters.join(' OR actorLogType=')})`);
  }
  if (scope.actorIds?.length) {
    const actorFilters = scope.actorIds.map((actorId) =>
      TimeSeriesDbExtension.quoteStringLiteral(actorId),
    );
    clauses.push(`(actorId=${actorFilters.join(' OR actorId=')})`);
  }
  return clauses.join(' AND ');
}
