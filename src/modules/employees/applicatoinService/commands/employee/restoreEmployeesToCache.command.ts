import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Command } from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { EMPLOYEE_REPOSITORY } from '../../../infra/diTokens/employee.diToken';
import { EmployeeRepository } from '../../../infra/repositories/employee.repository';

export class RestoreEmployeesToCacheCommand extends Command {
  constructor() {
    super({ id: '' });
  }
}

@CommandHandler(RestoreEmployeesToCacheCommand)
export class RestoreEmployeesToCacheCommandHandler
  implements ICommandHandler<RestoreEmployeesToCacheCommand>
{
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    protected readonly employeeRepo: EmployeeRepository,
  ) {}

  async execute(command: RestoreEmployeesToCacheCommand): Promise<AggregateID> {
    await this.employeeRepo.restoreAndInitRecordsToCache();
    return command.id;
  }
}
