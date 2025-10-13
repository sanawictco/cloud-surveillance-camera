import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { ActorLogApiService } from 'src/modules/actorLogs/applicationService/services/actorLogApi.service';
import { RestoreEmployeesToCacheCommand } from '../commands/employee/restoreEmployeesToCache.command';
import { FindAllEmployeesQuery } from '../queries/employee/findAllEmployees.queryHandler';
import { EmployeeService } from './employee.service';

@Injectable()
export class EmployeeInitService implements OnApplicationBootstrap {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly actorLogApiService: ActorLogApiService,
    private readonly serviceProvider: ServiceProvider,
    private readonly moduleRef: ModuleRef,
  ) {}
  async onApplicationBootstrap() {
    this.moduleRef.create(FindAllEmployeesQuery);
    const employees = await this.employeeService.findAll();
    for (const employee of employees) {
      if (employee.isOwner) {
        await this.actorLogApiService.createSubTable(employee.userId);
      }
    }
    await this.serviceProvider.commandBus.execute(
      new RestoreEmployeesToCacheCommand(),
    );
  }
}
