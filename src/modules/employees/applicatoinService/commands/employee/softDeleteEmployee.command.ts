import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { EmployeeEntity } from 'src/modules/employees/domain/entities/employee.entity';
import { EMPLOYEE_REPOSITORY } from '../../../infra/diTokens/employee.diToken';
import { EmployeeRepository } from '../../../infra/repositories/employee.repository';
import { EmployeesActorLogService } from '../../services/employeesActorLog.service';

export class SoftDeleteEmployeeCommand extends Command {
  phoneNumber: string;
  constructor(props: CommandProps<SoftDeleteEmployeeCommand> & IdType) {
    super(props);
    this.phoneNumber = props.phoneNumber;
  }
}

@CommandHandler(SoftDeleteEmployeeCommand)
export class SoftDeleteEmployeeCommandHandler
  implements ICommandHandler<SoftDeleteEmployeeCommand>
{
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    protected readonly employeeRepo: EmployeeRepository,
    protected readonly employeesActorLogService: EmployeesActorLogService,
  ) {}

  async execute(command: SoftDeleteEmployeeCommand): Promise<AggregateID> {
    const employeeEntity: EmployeeEntity | undefined =
      await this.employeeRepo.findById(command.id);
    if (!employeeEntity) throw new Error('entity not exists');
    employeeEntity.softDelete();
    await this.employeeRepo.update(employeeEntity);
    await this.processDependencies(command);
    return command.id;
  }
  private async processDependencies(command: SoftDeleteEmployeeCommand) {
    await this.employeesActorLogService.softDeleted(command.phoneNumber);
  }
}
