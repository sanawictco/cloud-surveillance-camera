import { Inject, Injectable } from '@nestjs/common';
import {
  InsertDataParams,
  TimeseriesRepositoryBase,
} from 'src/dddLib/infra/timeseriesRepository.base';

import { ArgumentInvalidException } from 'src/dddLib/core/exceptions';
import { Guard } from 'src/dddLib/utils';
import { TimeSeriesDbExtension } from 'src/dddLib/utils/timeSeriesDbExtension';
import {
  SYSTEM_LOG_MESSAGE_KEYS_COLUMN_SIZE,
  SYSTEM_LOG_MESSAGE_PARAMS_COLUMN_SIZE,
  SYSTEM_LOG_SECTION_COLUMN_SIZE,
  SYSTEM_LOG_ENTITY_ID_COLUMN_SIZE,
  SYSTEM_LOG_TENANT_ID_COLUMN_SIZE,
  SystemLogRecordFormat,
  SystemLogTypes,
  assertSystemLogTenantId,
  assertSystemLogTypes,
  systemLogColumnNames,
  systemLogColumnTypes,
  systemLogSubTableName,
  systemLogSuperTableName,
} from '../../domain/systemLog.type';
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
export class SystemLogRepository
  extends TimeseriesRepository
  implements TimeseriesRepositoryBase<SystemLogRecordFormat>
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
   * Creates the tenant's own supertable once per process, mirroring
   * ActorLogRepository. Tenant provisioning therefore needs no separate step;
   * `CREATE STABLE IF NOT EXISTS` keeps repeated boots and replica races
   * cheap. Public so read and cleanup paths can guarantee the stable exists
   * before querying it — a fresh tenant with zero logs would otherwise hit a
   * "table does not exist" error on every SELECT.
   */
  async ensureSuperTable(tenantId: string): Promise<void> {
    const superTableName = systemLogSuperTableName(tenantId);
    if (this.ensuredStables.has(superTableName)) return;
    await this.tdengineClient.exec(
      TimeSeriesDbExtension.createSuperTableQuery({
        superTableName,
        columnNames: systemLogColumnNames,
        columnDataTypes: systemLogColumnTypes,
        tags: [
          {
            name: 'tenantId',
            dataType: `VARCHAR(${SYSTEM_LOG_TENANT_ID_COLUMN_SIZE})`,
          },
          { name: 'groupId', dataType: 'VARCHAR(15)' },
        ],
      }),
    );
    this.ensuredStables.add(superTableName);
  }

  async insert(params: InsertDataParams<SystemLogRecordFormat>): Promise<void> {
    const { data } = params;
    const [tenantId, type, messageProps, section, entityId] = data;
    assertSystemLogTenantId(tenantId);
    assertSystemLogTypes([type]);
    const subTableName = systemLogSubTableName(tenantId, type);
    await this.ensureSuperTable(tenantId);
    const requestedTimestamp = params?.createdAt ?? Date.now();
    const createdAt = this.timestampAllocator.next(
      subTableName,
      requestedTimestamp,
    );
    const { superTableInsertFormat, subTableInsertFormat } =
      TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat(
        systemLogSuperTableName(tenantId),
        subTableName,
      );
    const messageParams = messageProps.params
      ? messageProps.params.join(',')
      : '';
    if (
      !Guard.isUnix(createdAt) ||
      !Guard.isBetween(tenantId, 1, SYSTEM_LOG_TENANT_ID_COLUMN_SIZE) ||
      !Guard.isBetween(
        messageProps.key,
        1,
        SYSTEM_LOG_MESSAGE_KEYS_COLUMN_SIZE,
      ) ||
      !Guard.isBetween(
        messageParams,
        0,
        SYSTEM_LOG_MESSAGE_PARAMS_COLUMN_SIZE,
      ) ||
      !Guard.isBetween(section, 1, SYSTEM_LOG_SECTION_COLUMN_SIZE) ||
      !Guard.isBetween(entityId, 1, SYSTEM_LOG_ENTITY_ID_COLUMN_SIZE)
    ) {
      throw new ArgumentInvalidException('invalid systemLog record : ' + data);
    }
    const values = TimeSeriesDbExtension.getValuesInsertFormat([
      createdAt,
      messageProps.key,
      messageParams,
      section,
      entityId,
    ]);
    const sql =
      `INSERT INTO ${subTableInsertFormat} 
      USING ${superTableInsertFormat} (tenantId, groupId)` +
      ` TAGS (${TimeSeriesDbExtension.getValuesInsertFormat([tenantId, type])})` +
      ` (${systemLogColumnNames.join(', ')}) VALUES (${values});`;
    await this.tdengineClient.exec(sql);
  }

  async deleteAll(tenantId: string, entityId: string): Promise<void> {
    assertSystemLogTenantId(tenantId);
    await this.ensureSuperTable(tenantId);
    if (!Guard.isBetween(entityId, 1, SYSTEM_LOG_ENTITY_ID_COLUMN_SIZE)) {
      throw new ArgumentInvalidException('invalid system log entityId');
    }
    const entityFilter = TimeSeriesDbExtension.quoteStringLiteral(entityId);
    for (const type of Object.values(SystemLogTypes)) {
      const subTableName = systemLogSubTableName(tenantId, type);
      const deletedRecords: Array<[number | string]> = await this.findAll({
        superTableName: systemLogSuperTableName(tenantId),
        selectedColumns: ['createdAt'],
        filter:
          `tenantId=${TimeSeriesDbExtension.quoteStringLiteral(tenantId)} ` +
          `AND groupId=${TimeSeriesDbExtension.quoteStringLiteral(type)} ` +
          `AND entityId=${entityFilter}`,
      });
      const { subTableInsertFormat } =
        TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat(
          systemLogSuperTableName(tenantId),
          subTableName,
        );
      for (const [createdAt] of deletedRecords) {
        const timestamp = TimeSeriesDbExtension.getValuesInsertFormat([
          createdAt,
        ]);
        await this.tdengineClient.exec(
          `DELETE FROM ${subTableInsertFormat} WHERE createdAt=${timestamp};`,
        );
      }
    }
  }
}
