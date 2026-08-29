import { Inject, Injectable } from '@nestjs/common';
import {
  InsertDataParams,
  TimeseriesRepositoryBase,
} from 'src/dddLib/infra/timeseriesRepository.base';

import { ArgumentInvalidException } from 'src/dddLib/core/exceptions';
import { Guard } from 'src/dddLib/utils';
import { TimeSeriesDbExtension } from 'src/dddLib/utils/timeSeriesDbExtension';
import {
  SYSTEM_LOG_ENTITY_ID_COLUMN_SIZE,
  SYSTEM_LOG_MESSAGE_KEYS_COLUMN_SIZE,
  SYSTEM_LOG_MESSAGE_PARAMS_COLUMN_SIZE,
  SYSTEM_LOG_SECTION_COLUMN_SIZE,
  SYSTEM_LOG_SUPER_TABLE,
  SYSTEM_LOG_TENANT_ID_COLUMN_SIZE,
  SystemLogRecordFormat,
  SystemLogTypes,
  assertSystemLogTenantId,
  systemLogColumnNames,
  systemLogSubTableName,
} from '../../domain/systemLog.type';
import {
  TDENGINE_CLIENT,
  TDENGINE_RESTFULL_OPTIONS,
  TimeseriesRepository,
} from 'src/modules/shared/timeseriesRepository';
import type {
  TdengineClient,
  TdengineRestOptions,
} from 'src/modules/shared/timeseriesRepository';

@Injectable()
export class SystemLogRepository
  extends TimeseriesRepository
  implements TimeseriesRepositoryBase<SystemLogRecordFormat>
{
  private readonly lastTimestampByTable = new Map<string, number>();

  constructor(
    @Inject(TDENGINE_CLIENT) tdengineClient: TdengineClient,
    @Inject(TDENGINE_RESTFULL_OPTIONS)
    tdengineRestOptions: TdengineRestOptions,
  ) {
    super(tdengineClient, tdengineRestOptions);
  }

  async insert(params: InsertDataParams<SystemLogRecordFormat>): Promise<void> {
    const { data } = params;
    const [tenantId, messageProps, section, entityId] = data;
    const type = params.subTableName as SystemLogTypes;
    assertSystemLogTenantId(tenantId);
    const subTableName = systemLogSubTableName(tenantId, type);
    const requestedTimestamp = params?.createdAt ?? Date.now();
    const previousTimestamp = this.lastTimestampByTable.get(subTableName) ?? 0;
    const createdAt = Math.max(requestedTimestamp, previousTimestamp + 1);
    this.lastTimestampByTable.set(subTableName, createdAt);
    const { superTableInsertFormat, subTableInsertFormat } =
      TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat(
        SYSTEM_LOG_SUPER_TABLE,
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
    if (!Guard.isBetween(entityId, 1, SYSTEM_LOG_ENTITY_ID_COLUMN_SIZE)) {
      throw new ArgumentInvalidException('invalid system log entityId');
    }
    const entityFilter = TimeSeriesDbExtension.getValuesInsertFormat([
      entityId,
    ]);
    for (const type of Object.values(SystemLogTypes)) {
      const subTableName = systemLogSubTableName(tenantId, type);
      const deletedRecords: Array<[number | string]> = await this.findAll({
        superTableName: SYSTEM_LOG_SUPER_TABLE,
        selectedColumns: ['createdAt'],
        filter: `tenantId='${tenantId}' AND groupId='${type}' AND entityId=${entityFilter}`,
      });
      const { subTableInsertFormat } =
        TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat(
          SYSTEM_LOG_SUPER_TABLE,
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
