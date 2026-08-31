import { Inject, Injectable } from '@nestjs/common';
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
  TDENGINE_EXECUTOR,
  TDENGINE_RESTFULL_OPTIONS as TDENGINE_REST_OPTIONS,
} from 'src/extensions/tdengine/tdeinge.tokens';

import {
  SYSTEM_LOG_SUPER_TABLE,
  SYSTEM_LOG_TENANT_ID_COLUMN_SIZE,
  systemLogColumnNames,
  systemLogColumnTypes,
} from 'src/modules/systemLogs/domain/systemLog.type';
const axios = require('axios');
export const TDENGINE_CLIENT = TDENGINE_EXECUTOR;
export const TDENGINE_RESTFULL_OPTIONS = TDENGINE_REST_OPTIONS;

export interface TdengineClient {
  exec(query: string): Promise<unknown>;
}

export interface TdengineRestOptions {
  restUrl: string;
  token: string;
}

@Injectable()
export class TimeseriesRepository {
  constructor(
    @Inject(TDENGINE_CLIENT)
    protected readonly tdengineClient: TdengineClient,
    @Inject(TDENGINE_RESTFULL_OPTIONS)
    protected readonly tdengineRestOptions: TdengineRestOptions,
  ) {}
  async initSuperTables(): Promise<void> {
    // Actor-log supertables are NOT created here: they are per-tenant
    // (actor_log_t_<tenant>) and are ensured once per process by
    // ActorLogRepository on each tenant's first write.
    await this.tdengineClient.exec(
      TimeSeriesDbExtension.createSuperTableQuery({
        superTableName: SYSTEM_LOG_SUPER_TABLE,
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
  }

  async restHealthCheck(): Promise<boolean> {
    try {
      const response = await axios({
        method: 'POST',
        url: this.tdengineRestOptions.restUrl,
        headers: {
          'Content-Type': 'text/plain',
          Authorization: this.tdengineRestOptions.token,
        },
        data: 'SELECT SERVER_VERSION()',
      });
      return Array.isArray(response.data?.data);
    } catch {
      return false;
    }
  }

  async createSubTable(params: CreateSubTableParams, entity?: any) {
    console.log(entity ? '' : '');
    const createSubTableSqlCommand =
      TimeSeriesDbExtension.createSubTableQuery(params);
    await this.tdengineClient.exec(createSubTableSqlCommand);
  }

  async findAll(params: FindDataParams): Promise<any> {
    if (
      ObjectExtension.isObjectEmpty(
        params as unknown as Record<string, unknown>,
      )
    )
      throw new Error('params in find method is empty');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const query = TimeSeriesDbExtension.createFindAllQuery(params);
    return await this.restQuery(query);
  }

  async findAllPaginated(
    params: PaginatedTimeseriesQueryBase,
  ): Promise<Paginated<any>> {
    if (
      ObjectExtension.isObjectEmpty(
        params as unknown as Record<string, unknown>,
      )
    )
      throw new Error('params in find method is empty');
    if (!params.orderBy) {
      params.orderBy = { column: 'createdAt', status: OrderStates.DESCENDING };
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    const query = TimeSeriesDbExtension.createFindAllQuery(params);
    const data: any = await this.restQuery(query);
    return {
      totalDocs: await this.count({
        superTableName: params.superTableName,
        subTableName: params.subTableName,
        timeRangeInUnix: params.timeRangeInUnix,
        filter: params.filter,
      }),
      page: params.page,
      limit: params.limit,
      docs: data,
    };
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
      if (Array.isArray(response.data?.data)) {
        return response.data.data;
      }
      throw new Error('returned data from tdengine not valid');
    } catch (err) {
      console.log('restQuery failed => ', err);
      throw err;
    }
  }
}
