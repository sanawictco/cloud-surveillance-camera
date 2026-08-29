import { AggregateID } from 'src/dddLib/core';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SMS_NOTIFIER_REPOSITORY } from 'src/modules/smsNotifier/infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from 'src/modules/smsNotifier/infra/repositories/smsNotifier.repository';
import { SmsNotifierEntity } from 'src/modules/smsNotifier/domain/entities/smsNotifier.entity';
import { EmployeesActorLogService } from '../../services/employeesActorLog.service';
export class DeleteSmsNotifierCommand extends Command {
  phoneNumber: string;
  readonly tenantId: string;
  constructor(props: CommandProps<DeleteSmsNotifierCommand> & IdType) {
    super(props);
    this.phoneNumber = props.phoneNumber;
    this.tenantId = props.tenantId;
  }
}
@CommandHandler(DeleteSmsNotifierCommand)
export class DeleteSmsNotifierCommandHandler implements ICommandHandler<DeleteSmsNotifierCommand> {
  constructor(
    @Inject(SMS_NOTIFIER_REPOSITORY)
    protected readonly smsNotifierRepo: SmsNotifierRepository,
    private readonly employeesActorLogService: EmployeesActorLogService,
  ) {}

  async execute(command: DeleteSmsNotifierCommand): Promise<AggregateID> {
    const smsNotifierEntity: SmsNotifierEntity | undefined =
      await this.smsNotifierRepo.findByIdForTenant(
        command.tenantId,
        command.id,
      );
    if (!smsNotifierEntity) throw new Error('entity not exists');
    smsNotifierEntity.delete();
    await this.smsNotifierRepo.delete(smsNotifierEntity);
    await this.processDepenedencies(command);
    return command.id;
  }

  private async processDepenedencies(command: DeleteSmsNotifierCommand) {
    await this.employeesActorLogService.smsNotifierDeleted(command.phoneNumber);
  }
}
