import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AggregateID } from 'src/dddLib/core';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { UpdateEmployeeProps } from '../../../domain/types/employee.type';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { EMPLOYEE_REPOSITORY } from '../../../infra/diTokens/employee.diToken';
import { EmployeeRepository } from '../../../infra/repositories/employee.repository';
import { EmployeeEntity } from '../../../domain/entities/employee.entity';
import { EmployeesActorLogService } from '../../services/employeesActorLog.service';

export class UpdateEmployeeCommand
  extends Command
  implements Partial<UpdateEmployeeProps>
{
  readonly roles?: EmployeeRoles[];
  readonly isDeleted?: boolean;
  readonly phoneNumber: string;

  constructor(props: CommandProps<UpdateEmployeeCommand> & IdType) {
    super(props);
    this.roles = props.roles;
    this.isDeleted = props.isDeleted;
    this.phoneNumber = props.phoneNumber;
  }
}

@CommandHandler(UpdateEmployeeCommand)
export class UpdateEmployeeCommandHandler
  implements ICommandHandler<UpdateEmployeeCommand>
{
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    protected readonly employeeRepo: EmployeeRepository,
    protected readonly employeesActorLogService: EmployeesActorLogService,
  ) {}

  async execute(command: UpdateEmployeeCommand): Promise<AggregateID> {
    const employeeEntity: EmployeeEntity | undefined =
      await this.employeeRepo.findById(command.id);
    const updateObj = {
      roles: command.roles,
      isDeleted: command.isDeleted,
    };
    if (!employeeEntity) throw new Error('entity not exists');
    employeeEntity.update(updateObj);
    await this.employeeRepo.update(employeeEntity);
    await this.processDependencies(command);
    return command.id;
  }
  private async processDependencies(command: UpdateEmployeeCommand) {
    await this.employeesActorLogService.rolesUpdated(command.phoneNumber);
  }
}
