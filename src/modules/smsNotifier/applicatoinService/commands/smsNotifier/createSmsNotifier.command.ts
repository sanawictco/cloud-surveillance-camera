import { AggregateID } from 'src/dddLib/core';
import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SmsNotifierEntity } from 'src/modules/smsNotifier/domain/entities/smsNotifier.entity';
import { CreateSmsNotifierProps } from 'src/modules/smsNotifier/domain/types/smsNotifier.type';
import { SMS_NOTIFIER_REPOSITORY } from 'src/modules/smsNotifier/infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from 'src/modules/smsNotifier/infra/repositories/smsNotifier.repository';
import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';
import { EmployeesActorLogService } from '../../services/employeesActorLog.service';

export class CreateSmsNotifierCommand
  extends Command
  implements CreateSmsNotifierProps
{
  readonly userId: string;
  readonly tenantId: string;
  readonly phoneNumber: string;
  readonly systemLogTypes: SystemLogTypes[];

  constructor(props: CommandProps<CreateSmsNotifierCommand>) {
    super(props);
    this.userId = props.userId;
    this.tenantId = props.tenantId;
    this.phoneNumber = props.phoneNumber;
    this.systemLogTypes = props.systemLogTypes;
  }
}

@CommandHandler(CreateSmsNotifierCommand)
export class CreateSmsNotifierCommandHandler implements ICommandHandler<CreateSmsNotifierCommand> {
  constructor(
    @Inject(SMS_NOTIFIER_REPOSITORY)
    protected readonly smsNotifierRepo: SmsNotifierRepository,
    private readonly employeesActorLogService: EmployeesActorLogService,
  ) {}

  async execute(command: CreateSmsNotifierCommand): Promise<AggregateID> {
    const smsNotifier = SmsNotifierEntity.create({
      tenantId: command.tenantId,
      userId: command.userId,
      systemLogTypes: command.systemLogTypes,
    });
    await this.smsNotifierRepo.insert(smsNotifier);
    await this.processDependencies(command);
    return smsNotifier.id;
  }

  private async processDependencies(command: CreateSmsNotifierCommand) {
    await this.employeesActorLogService.smsNotifierAdded(command.phoneNumber);
  }
}
