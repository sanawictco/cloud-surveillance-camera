import { AggregateID } from 'src/dddLib/core';
import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { forwardRef, Inject } from '@nestjs/common';
import { EmployeeRepository } from '../../../infra/repositories/employee.repository';
import { EmployeeEntity } from '../../../domain/entities/employee.entity';
import { EMPLOYEE_REPOSITORY } from '../../../infra/diTokens/employee.diToken';
import { CreateEmployeeProps } from '../../../domain/types/employee.type';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { ActorLogApiService } from 'src/modules/actorLogs/applicationService/services/actorLogApi.service';
import { EmployeesActorLogService } from '../../services/employeesActorLog.service';

export class CreateEmployeeCommand
  extends Command
  implements CreateEmployeeProps
{
  readonly userId: string;
  readonly phoneNumber: string;
  readonly roles: EmployeeRoles[];

  constructor(props: CommandProps<CreateEmployeeCommand>) {
    super(props);
    this.userId = props.userId;
    this.phoneNumber = props.phoneNumber;
    this.roles = props.roles;
  }
}

@CommandHandler(CreateEmployeeCommand)
export class CreateEmployeeCommandHandler
  implements ICommandHandler<CreateEmployeeCommand>
{
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    protected readonly employeeRepo: EmployeeRepository,
    @Inject(forwardRef(() => ActorLogApiService))
    protected readonly actorLogApiService: ActorLogApiService,
    private readonly employeesActorLogService: EmployeesActorLogService,
  ) {}

  async execute(command: CreateEmployeeCommand): Promise<AggregateID> {
    const employee = EmployeeEntity.create({
      userId: command.userId,
      roles: command.roles,
    });
    await this.employeeRepo.insert(employee);
    await this.processDependencies(command);
    return employee.id;
  }

  private async processDependencies(command: CreateEmployeeCommand) {
    await this.actorLogApiService.createSubTable(command.userId);
    await this.employeesActorLogService.added(command.phoneNumber);
  }
}
