import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { EmployeeEntity } from 'src/modules/employees/domain/entities/employee.entity';
import { EMPLOYEE_REPOSITORY } from '../../../infra/diTokens/employee.diToken';
import { EmployeeRepository } from '../../../infra/repositories/employee.repository';
import { EmployeesActorLogService } from '../../services/employeesActorLog.service';

export class RecoveryEmployeeCommand extends Command {
  phoneNumber: string;
  constructor(props: CommandProps<RecoveryEmployeeCommand>) {
    super(props);
    this.phoneNumber = props.phoneNumber;
  }
}

@CommandHandler(RecoveryEmployeeCommand)
export class RecoveryEmployeeCommandHandler
  implements ICommandHandler<RecoveryEmployeeCommand>
{
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    protected readonly employeeRepo: EmployeeRepository,
    protected readonly employeesActorLogService: EmployeesActorLogService,
  ) {}

  async execute(command: RecoveryEmployeeCommand): Promise<AggregateID> {
    const employeeEntity: EmployeeEntity | undefined =
      await this.employeeRepo.findById(command.id);
    if (!employeeEntity) throw new Error('entity not exists');
    employeeEntity.recovery();
    await this.employeeRepo.update(employeeEntity);
    await this.processDependencies(command);
    return command.id;
  }

  private async processDependencies(command: RecoveryEmployeeCommand) {
    await this.employeesActorLogService.recovered(command.phoneNumber);
  }
}
