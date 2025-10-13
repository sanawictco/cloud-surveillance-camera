import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  OrderStates,
  PaginatedTimeseriesQueryBase,
} from 'src/dddLib/applicationService';
import { Paginated } from 'src/dddLib/infra';
import {
  CountDataParams,
  CreateSubTableParams,
  FindDataParams,
} from 'src/dddLib/infra/timeseriesRepository.base';
import { ObjectExtension } from 'src/dddLib/utils/objectExtension';
import { TimeSeriesDbExtension } from 'src/dddLib/utils/timeSeriesDbExtension';

import {
  SYSTEM_LOG_SUPER_TABLE,
  systemLogColumnNames,
  systemLogColumnTypes,
  systemlogSubTableNames,
} from 'src/modules/systemLogs/domain/systemLog.type';
const axios = require('axios');
export const TDENGINE_CLIENT = Symbol('TDENGINE_CLIENT');
export const TDENGINE_RESTFULL_OPTIONS = Symbol('TDENGINE_RESTFULL_OPTIONS');

@Injectable()
export class TimeseriesRepository implements OnApplicationBootstrap {
  @Inject(TDENGINE_CLIENT) protected readonly tdengineClient;
  @Inject(TDENGINE_RESTFULL_OPTIONS) protected readonly tdengineRestOptions;
  constructor() {}
  async onApplicationBootstrap() {
    await this.tdengineClient.exec(
      TimeSeriesDbExtension.createSuperTableQuery(
        {
          superTableName: SYSTEM_LOG_SUPER_TABLE,
          columnNames: systemLogColumnNames,
          columnDataTypes: systemLogColumnTypes,
        },
        15,
      ),
    );

    for (const subTableName of systemlogSubTableNames) {
      await this.tdengineClient.exec(
        TimeSeriesDbExtension.createSubTableQuery({
          superTableName: SYSTEM_LOG_SUPER_TABLE,
          subTableName,
        }),
      );
    }
  }

  async createSubTable(params: CreateSubTableParams, entity?: any) {
    console.log(entity ? '' : '');
    const createSubTableSqlCommand =
      TimeSeriesDbExtension.createSubTableQuery(params);
    await this.tdengineClient.exec(createSubTableSqlCommand);
  }

  async findAll(params: FindDataParams): Promise<any> {
    if (ObjectExtension.isObjectEmpty(params))
      throw new Error('params in find method is empty');
    return new Promise((resolve) => {
      setTimeout(async () => {
        const query = TimeSeriesDbExtension.createFindAllQuery(params);
        const data: any = await this.restQuery(query);
        if (data) resolve(data);
        else resolve([]);
      }, 0);
    });
  }

  async findAllPaginated(
    params: PaginatedTimeseriesQueryBase,
  ): Promise<Paginated<any>> {
    if (ObjectExtension.isObjectEmpty(params))
      throw new Error('params in find method is empty');
    if (!params.orderBy) {
      params.orderBy = { column: 'createdAt', status: OrderStates.DESCENDING };
    }
    return new Promise((resolve) => {
      setTimeout(async () => {
        const query = TimeSeriesDbExtension.createFindAllQuery(params);
        const data: any = await this.restQuery(query);
        if (data)
          resolve({
            totalDocs: await this.count({
              superTableName: params.superTableName,
              subTableName: params.subTableName,
              timeRangeInUnix: params.timeRangeInUnix,
              filter: params.filter,
            }),
            page: params.page,
            limit: params.limit,
            docs: data,
          });
        else
          resolve({
            totalDocs: 0,
            page: params.page,
            limit: params.limit,
            docs: [],
          });
      }, 0);
    });
  }

  async deleteSubTable(subTableName: string) {
    const dropSqlSubTableCommand =
      'DROP TABLE IF EXISTS ' + '`' + `${subTableName}` + '`;';
    console.log('@@@@@@@@@@@@', dropSqlSubTableCommand);
    await this.tdengineClient.exec(dropSqlSubTableCommand);
  }

  async count(params: CountDataParams): Promise<number> {
    const { superTableName, subTableName } = params;
    if (superTableName === undefined && subTableName === undefined)
      throw new Error('parameter is not valid in count function');

    const query = TimeSeriesDbExtension.createCountQuery(params);
    const queryResult = await this.restQuery(query);
    let rowCount = 0;
    if (queryResult[0]) rowCount = queryResult[0][0];
    return rowCount;
  }

  private async restQuery(query: string) {
    try {
      const response = await axios({
        method: 'POST',
        url: this.tdengineRestOptions.restUrl,
        headers: {
          'Content-Type': 'text/plain',
          Authorization: this.tdengineRestOptions.token,
        },
        data: query,
      });
      if (response.data?.data) {
        return response.data.data;
      } else {
        console.log(query);
        console.log(response.data);
        throw new Error('returned data from tdengine not valid');
      }
    } catch (err) {
      console.log('restQuery failed => ', err);
    }
  }
}
