import { Inject, Injectable } from '@nestjs/common';
import {
  InsertDataParams,
  TimeseriesRepositoryBase,
} from 'src/dddLib/infra/timeseriesRepository.base';
import {
  ACTOR_LOG_ACTOR_ID_COLUMN_SIZE,
  ACTOR_LOG_ACTOR_LOG_TYPE_COLUMN_SIZE,
  ACTOR_LOG_MESSAGE_KEY_COLUMN_SIZE,
  ACTOR_LOG_MESSAGE_PARAMS_COLUMN_SIZE,
  ACTOR_LOG_TENANT_ID_COLUMN_SIZE,
  ActorLogRecordFormat,
  assertActorLogId,
  assertActorLogTenantId,
  assertActorLogTypes,
  actorLogColumnNames,
  actorLogColumnTypes,
  actorLogSubTableName,
  actorLogSuperTableName,
} from '../domain/actorLog.type';

import { ArgumentInvalidException } from 'src/dddLib/core/exceptions';
import { Guard } from 'src/dddLib/utils';
import { TimeSeriesDbExtension } from 'src/dddLib/utils/timeSeriesDbExtension';
import {
  TDENGINE_CLIENT,
  TDENGINE_RESTFULL_OPTIONS,
  TimeseriesRepository,
} from 'src/modules/shared/timeseriesRepository';
import { MonotonicTimestampAllocator } from 'src/modules/shared/monotonicTimestamp';
import type {
  TdengineClient,
  TdengineRestOptions,
} from 'src/modules/shared/timeseriesRepository';

@Injectable()
export class ActorLogRepository
  extends TimeseriesRepository
  implements TimeseriesRepositoryBase<ActorLogRecordFormat>
{
  private readonly timestampAllocator = new MonotonicTimestampAllocator();
  private readonly ensuredStables = new Set<string>();

  constructor(
    @Inject(TDENGINE_CLIENT) tdengineClient: TdengineClient,
    @Inject(TDENGINE_RESTFULL_OPTIONS)
    tdengineRestOptions: TdengineRestOptions,
  ) {
    super(tdengineClient, tdengineRestOptions);
  }

  /**
   * Creates the tenant's own supertable once per process when its first actor
   * event is written. Tenant provisioning therefore needs no separate step;
   * `CREATE STABLE IF NOT EXISTS` keeps repeated boots cheap.
   *
   * Public so the fog-backup TDengine restore path can guarantee the stable
   * exists before writing into it — mirrors SystemLogRepository's own
   * ensureSuperTable, public for the identical reason.
   */
  async ensureSuperTable(tenantId: string): Promise<void> {
    const superTableName = actorLogSuperTableName(tenantId);
    if (this.ensuredStables.has(superTableName)) return;
    await this.tdengineClient.exec(
      TimeSeriesDbExtension.createSuperTableQuery({
        superTableName,
        columnNames: actorLogColumnNames,
        columnDataTypes: actorLogColumnTypes,
        tags: [
          {
            name: 'tenantId',
            dataType: `VARCHAR(${ACTOR_LOG_TENANT_ID_COLUMN_SIZE})`,
          },
          {
            name: 'actorId',
            dataType: `NCHAR(${ACTOR_LOG_ACTOR_ID_COLUMN_SIZE})`,
          },
        ],
      }),
    );
    this.ensuredStables.add(superTableName);
  }

  /**
   * Writes one actor event to the (tenant, actor) child table. The stable and
   * child names are always derived server-side from validated UUIDs;
   * caller-supplied table names are ignored, so a caller can never select
   * another tenant's or actor's table. Tags carry the tenant and actor so
   * stable-level reads stay filterable.
   */
  async insert(params: InsertDataParams<ActorLogRecordFormat>): Promise<void> {
    const { data } = params;
    const [tenantId, actorType, actorId, messageProps] = data;
    assertActorLogTenantId(tenantId);
    assertActorLogTypes([actorType]);
    assertActorLogId(actorId);
    const subTableName = actorLogSubTableName(tenantId, actorId);
    await this.ensureSuperTable(tenantId);
    const requestedTimestamp = params?.createdAt ?? Date.now();
    const createdAt = this.timestampAllocator.next(
      subTableName,
      requestedTimestamp,
    );
    const messageParams = messageProps.params
      ? messageProps.params.join(',')
      : '';
    if (
      !Guard.isUnix(createdAt) ||
      !Guard.isBetween(actorId, 1, ACTOR_LOG_ACTOR_ID_COLUMN_SIZE) ||
      !Guard.isBetween(actorType, 1, ACTOR_LOG_ACTOR_LOG_TYPE_COLUMN_SIZE) ||
      !Guard.isBetween(
        messageProps.key,
        1,
        ACTOR_LOG_MESSAGE_KEY_COLUMN_SIZE,
      ) ||
      !Guard.isBetween(messageParams, 0, ACTOR_LOG_MESSAGE_PARAMS_COLUMN_SIZE)
    ) {
      throw new ArgumentInvalidException(
        'invalid actorLog timeseries record : ' + JSON.stringify(data),
      );
    }
    const { superTableInsertFormat, subTableInsertFormat } =
      TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat(
        actorLogSuperTableName(tenantId),
        subTableName,
      );
    const values = TimeSeriesDbExtension.getValuesInsertFormat([
      createdAt,
      actorType,
      messageProps.key,
      messageParams,
    ]);
    const sql =
      `INSERT INTO ${subTableInsertFormat} 
      USING ${superTableInsertFormat} (tenantId, actorId)` +
      ` TAGS (${TimeSeriesDbExtension.getValuesInsertFormat([tenantId, actorId])})` +
      ` (${actorLogColumnNames.join(', ')}) VALUES (${values});`;
    await this.tdengineClient.exec(sql);
  }

  /**
   * Removes one actor's entire history by dropping their child table inside
   * the tenant's own supertable — one instant statement, tenant-scoped by
   * construction. Another tenant's records for the same SSO user live under a
   * different supertable and are untouched.
   */
  async dropByActor(tenantId: string, actorId: string): Promise<void> {
    assertActorLogTenantId(tenantId);
    assertActorLogId(actorId);
    const { subTableInsertFormat } =
      TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat(
        actorLogSuperTableName(tenantId),
        actorLogSubTableName(tenantId, actorId),
      );
    await this.tdengineClient.exec(
      `DROP TABLE IF EXISTS ${subTableInsertFormat};`,
    );
  }
}
