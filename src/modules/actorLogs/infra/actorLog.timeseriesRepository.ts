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
  ActorLogRecordFormat,
} from '../domain/actorLog.type';

import { ArgumentInvalidException } from 'src/dddLib/core/exceptions';
import { Guard } from 'src/dddLib/utils';
import { TimeSeriesDbExtension } from 'src/dddLib/utils/timeSeriesDbExtension';
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
export class ActorLogRepository
  extends TimeseriesRepository
  implements TimeseriesRepositoryBase<ActorLogRecordFormat>
{
  constructor(
    @Inject(TDENGINE_CLIENT) tdengineClient: TdengineClient,
    @Inject(TDENGINE_RESTFULL_OPTIONS)
    tdengineRestOptions: TdengineRestOptions,
  ) {
    super(tdengineClient, tdengineRestOptions);
  }

  async insert(params: InsertDataParams<ActorLogRecordFormat>): Promise<void> {
    const { superTableName, subTableName, data } = params;
    const { superTableInsertFormat, subTableInsertFormat } =
      TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat(
        superTableName,
        subTableName,
      );
    if (
      !Guard.isUnix(data[0]) ||
      !Guard.isBetween(data[1], 0, ACTOR_LOG_ACTOR_LOG_TYPE_COLUMN_SIZE) ||
      !Guard.isBetween(data[2], 0, ACTOR_LOG_ACTOR_ID_COLUMN_SIZE) ||
      !Guard.isBetween(data[3].key, 0, ACTOR_LOG_MESSAGE_KEY_COLUMN_SIZE) ||
      !Guard.isBetween(
        data[3].params.join(','),
        0,
        ACTOR_LOG_MESSAGE_PARAMS_COLUMN_SIZE,
      )
    ) {
      throw new ArgumentInvalidException(
        'invalid actorLog timeseries record : ' + data,
      );
    }
    const values = TimeSeriesDbExtension.getValuesInsertFormat([
      data[0],
      data[1],
      data[2],
      data[3].key,
      data[3].params.join(','),
    ]);

    const sql =
      `INSERT INTO ${subTableInsertFormat} 
      USING ${superTableInsertFormat} 
      TAGS ("${params.subTableName}")` + ` VALUES (${values});`;

    await this.tdengineClient.exec(sql);
  }
}
