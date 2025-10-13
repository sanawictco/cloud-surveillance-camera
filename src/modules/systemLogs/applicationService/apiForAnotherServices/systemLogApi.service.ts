import { Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { SmsNotifierEntity } from '../../../employees/domain/entities/smsNotifier.entity';
import {
  systemLogColumnNames,
  SystemLogTypes,
} from '../../domain/systemLog.type';
import { CountAllSystemLogsQuery } from '../queries/systemLog/countAllSystemLogs.queryHandler';
import { FindAllPaginatedSystemLogsQuery } from '../queries/systemLog/findAllPaginatedSystemLogs.queryHandler';
import { FindAllSystemLogsQuery } from '../queries/systemLog/findAllSystemLogs.queryHandler';
import { FindSmsNotifierByUserIdQuery } from 'src/modules/employees/applicatoinService/queries/smsNotifier/findSmsNotifierByUserId.queryHandler';
import { DeleteSmsNotifierCommand } from 'src/modules/employees/applicatoinService/commands/smsNotifier/deleteSmsNotifier.command';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moment = require('jalali-moment');

@Injectable()
export class SystemLogApiService {
  constructor(private readonly serviceProvider: ServiceProvider) {}

  async removeSmsNotifier(phoneNumber: string) {
    const smsNotifierEntity: SmsNotifierEntity =
      await this.serviceProvider.queryBus.execute(
        new FindSmsNotifierByUserIdQuery(phoneNumber),
      );
    if (smsNotifierEntity)
      await this.serviceProvider.commandBus.execute(
        new DeleteSmsNotifierCommand({ id: smsNotifierEntity.id, phoneNumber }),
      );
  }

  private async getAllSystemLogs(
    fromDateTimeInUnix: number,
    toDateTimeInUnix: number,
    paginationOptions?: { page: number; limit: number },
  ) {
    let systemLogs;
    let numberOfRecords;
    if (paginationOptions) {
      numberOfRecords = await this.serviceProvider.queryBus.execute(
        new CountAllSystemLogsQuery({
          timeRangeInUnix: {
            start: fromDateTimeInUnix,
            end: toDateTimeInUnix,
          },
          types: [],
        }),
      );

      systemLogs = await this.serviceProvider.queryBus.execute(
        new FindAllPaginatedSystemLogsQuery({
          timeRangeInUnix: {
            start: fromDateTimeInUnix,
            end: toDateTimeInUnix,
          },
          ...paginationOptions,
          types: [],
        }),
      );
      systemLogs = systemLogs.docs;
    } else {
      systemLogs = await this.serviceProvider.queryBus.execute(
        new FindAllSystemLogsQuery({
          timeRangeInUnix: {
            start: fromDateTimeInUnix,
            end: toDateTimeInUnix,
          },
        }),
      );
    }
    return {
      data: { docs: systemLogs },
      numberOfRecords: numberOfRecords || systemLogs.length,
    };
  }

  private async getOneTypeSystemLogs(
    types: SystemLogTypes[],
    fromDateTimeInUnix: number,
    toDateTimeInUnix: number,
    paginationOptions?: { page: number; limit: number },
  ) {
    let systemLogs;
    let numberOfRecords;
    if (paginationOptions) {
      numberOfRecords = await this.serviceProvider.queryBus.execute(
        new CountAllSystemLogsQuery({
          timeRangeInUnix: {
            start: fromDateTimeInUnix,
            end: toDateTimeInUnix,
          },
          types: types,
        }),
      );
      systemLogs = await this.serviceProvider.queryBus.execute(
        new FindAllPaginatedSystemLogsQuery({
          types,
          timeRangeInUnix: {
            start: fromDateTimeInUnix,
            end: toDateTimeInUnix,
          },
          ...paginationOptions,
          selectedColumns: systemLogColumnNames,
        }),
      );
      systemLogs = systemLogs.docs;
    } else {
      systemLogs = await this.serviceProvider.queryBus.execute(
        new FindAllSystemLogsQuery({
          timeRangeInUnix: { start: fromDateTimeInUnix, end: toDateTimeInUnix },
          selectedColumns: systemLogColumnNames,
        }),
      );
    }
    return {
      data: { docs: systemLogs },
      numberOfRecords: numberOfRecords || systemLogs.length,
    };
  }
}
