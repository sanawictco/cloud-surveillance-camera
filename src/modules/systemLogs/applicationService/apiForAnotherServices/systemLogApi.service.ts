import { Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { SmsNotifierEntity } from '../../../employees/domain/entities/smsNotifier.entity';
import { FindSmsNotifierByUserIdQuery } from 'src/modules/employees/applicatoinService/queries/smsNotifier/findSmsNotifierByUserId.queryHandler';
import { DeleteSmsNotifierCommand } from 'src/modules/employees/applicatoinService/commands/smsNotifier/deleteSmsNotifier.command';
import { SystemLogService } from '../services/systemLog.service';
import { AggregateID } from 'src/dddLib/core';

@Injectable()
export class SystemLogApiService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly systemLogService: SystemLogService,
  ) {}

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

  deleteSystemLogs(id: AggregateID) {
    this.systemLogService.deleteSystemLogs(id);
  }
}
