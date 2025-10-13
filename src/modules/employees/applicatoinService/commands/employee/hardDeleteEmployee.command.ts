import { AggregateID } from 'src/dddLib/core';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EMPLOYEE_REPOSITORY } from '../../../infra/diTokens/employee.diToken';
import { EmployeeRepository } from '../../../infra/repositories/employee.repository';
import { EmployeeEntity } from 'src/modules/employees/domain/entities/employee.entity';
import { ActorLogApiService } from 'src/modules/actorLogs/applicationService/services/actorLogApi.service';
import { EmployeesActorLogService } from '../../services/employeesActorLog.service';

export class HardDeleteEmployeeCommand extends Command {
  phoneNumber: string;
  constructor(props: CommandProps<HardDeleteEmployeeCommand> & IdType) {
    super(props);
    this.phoneNumber = props.phoneNumber;
  }
}

@CommandHandler(HardDeleteEmployeeCommand)
export class HardDeleteEmployeeCommandHandler
  implements ICommandHandler<HardDeleteEmployeeCommand>
{
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    protected readonly employeeRepo: EmployeeRepository,
    @Inject(forwardRef(() => ActorLogApiService))
    protected readonly actorLogApiService: ActorLogApiService,
    private readonly employeesActorLogService: EmployeesActorLogService,
  ) {}

  async execute(command: HardDeleteEmployeeCommand): Promise<AggregateID> {
    const userId = command.id;
    const employeeEntity: EmployeeEntity | undefined =
      await this.employeeRepo.findOne({ userId });
    if (!employeeEntity) throw new Error('entity not exists');
    employeeEntity.hardDelete();
    await this.employeeRepo.delete(employeeEntity);
    await this.processDependencies(command);
    return userId;
  }
  private async processDependencies(command: HardDeleteEmployeeCommand) {
    const userId = command.id;
    await this.actorLogApiService.deleteSubTable(userId);
    await this.employeesActorLogService.deleted(command.phoneNumber);
  }
}
