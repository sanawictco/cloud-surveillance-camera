import {
  OrderBySetting,
  PaginatedTimeseriesQueryBase,
  TimeRangeInUnix,
} from '../applicationService';
import { Paginated } from './repository.base';

export class FindDataParams {
  superTableName?: string;
  subTableName?: string;
  selectedColumns?: string[];
  orderBy?: OrderBySetting;
  timeRangeInUnix?: TimeRangeInUnix;
  limit?: number;
  filter?: string;
}

export class CreateSuperTableParams {
  superTableName: string;
  columnNames: string[];
  columnDataTypes: string[];
}

export class CreateSubTableParams {
  superTableName: string;
  subTableName: string;
}

export class InsertDataParams<RecordFormat> {
  superTableName: string;
  subTableName: string;
  data: RecordFormat;
  createdAt?: number;
}

export class UpdateDataParams<RecordFormat> {
  superTableName: string;
  subTableName: string;
  data: RecordFormat;
  createdAt: number;
}

export class DeleteDataParams {
  superTableName: string;
  createdAt: number;
}

export class DeleteAllDataParams {
  superTableName: string;
}

export class CountDataParams {
  superTableName?: string;
  subTableName?: string;
  timeRangeInUnix?: TimeRangeInUnix;
  filter?: string;
}

export enum AggrigateMathFunctions {
  AVG = 'avg',
  LAST = 'last',
  MAX = 'max',
  MIN = 'min',
}

export class AggrigateDataParams {
  func: AggrigateMathFunctions;
  subTableName: string;
  columnIndex: number;
  timeRangeInUnix: TimeRangeInUnix;
}

export interface TimeseriesRepositoryBase<RecordFormat, Entity = unknown> {
  createSuperTable?(entity?: Entity);
  createSubTable(params: CreateSubTableParams, entity?: Entity);
  deleteSubTable(subTableName: string);
  findAll(params: FindDataParams): Promise<any>;
  findAllPaginated(
    params: PaginatedTimeseriesQueryBase,
  ): Promise<Paginated<any>>;
  insert(params: InsertDataParams<RecordFormat>): Promise<void>;
  count(params: CountDataParams): Promise<number>;
  // aggregate funcations in math not ddd aggregate
  findAggrigate?(params: AggrigateDataParams): Promise<number>;
  update?(params: Entity): Promise<Entity>;
}
