import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AggregateID } from 'src/dddLib/core';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { SmsNotifierEntity } from 'src/modules/smsNotifier/domain/entities/smsNotifier.entity';
import { UpdateSmsNotifierProps } from 'src/modules/smsNotifier/domain/types/smsNotifier.type';
import { SMS_NOTIFIER_REPOSITORY } from 'src/modules/smsNotifier/infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from 'src/modules/smsNotifier/infra/repositories/smsNotifier.repository';
import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';
import { EmployeesActorLogService } from '../../services/employeesActorLog.service';

export class UpdateSmsNotifierCommand
  extends Command
  implements Partial<UpdateSmsNotifierProps>
{
  readonly systemLogTypes: SystemLogTypes[];
  readonly tenantId: string;
  readonly phoneNumber: string;

  constructor(props: CommandProps<UpdateSmsNotifierCommand> & IdType) {
    super(props);
    this.systemLogTypes = props.systemLogTypes;
    this.tenantId = props.tenantId;
    this.phoneNumber = props.phoneNumber;
  }
}

@CommandHandler(UpdateSmsNotifierCommand)
export class UpdateSmsNotifierCommandHandler implements ICommandHandler<UpdateSmsNotifierCommand> {
  constructor(
    @Inject(SMS_NOTIFIER_REPOSITORY)
    protected readonly smsNotifierRepo: SmsNotifierRepository,
    private readonly employeesActorLogService: EmployeesActorLogService,
  ) {}

  async execute(command: UpdateSmsNotifierCommand): Promise<AggregateID> {
    const smsNotifier: SmsNotifierEntity | undefined =
      await this.smsNotifierRepo.findByIdForTenant(
        command.tenantId,
        command.id,
      );
    const updateObj = {
      systemLogTypes: command.systemLogTypes,
    };
    if (!smsNotifier) throw new Error('entity not exists');
    smsNotifier.update(updateObj);
    await this.smsNotifierRepo.update(smsNotifier);
    await this.processDependencies(command);
    return command.id;
  }

  private async processDependencies(command: UpdateSmsNotifierCommand) {
    await this.employeesActorLogService.smsNotifierUpdated(command.phoneNumber);
  }
}
