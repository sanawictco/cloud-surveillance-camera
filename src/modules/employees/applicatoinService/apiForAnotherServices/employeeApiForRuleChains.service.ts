import { Injectable } from '@nestjs/common';
import { SanawApiEmployeeService } from 'src/extensions/sanawApi/services/sanawApiEmployee.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { EmployeeEntity } from '../../domain/entities/employee.entity';
import { EmployeeMapper } from '../../infra/mappers/employee.mapper';
import { FindAllEmployeesQuery } from '../queries/employee/findAllEmployees.queryHandler';
import { EmployeeService } from '../services/employee.service';

@Injectable()
export class EmployeeApiForRuleChainsService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly mapper: EmployeeMapper,
    private readonly sanawApiEmployeeService: SanawApiEmployeeService,
    private readonly employeeService: EmployeeService,
  ) {}

  async findEmployeeWithUserId(
    userId: string,
  ): Promise<EmployeeEntity | undefined> {
    const employees = await this.employeeService.findAll();
    for (const employee of employees) {
      if (employee.userId === userId)
        return this.mapper.toDomain({
          id: employee.id,
          userId: employee.id,
          isDeleted: employee.isDeleted,
          roles: employee.roles,
          createdAt: new Date(employee.createdAt),
          updatedAt: new Date(employee.updatedAt),
        });
    }
  }

  async getSoftDeletedEmployees() {
    const softDeletedEmployeeEntities: EmployeeEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllEmployeesQuery({ filter: { isDeleted: true } }),
      );
    const userIds: string[] = [];
    for (const employeeEntity of softDeletedEmployeeEntities) {
      userIds.push(employeeEntity.getProps().userId);
    }
    const result = await this.sanawApiEmployeeService.findAll(userIds);
    const softDeletedEmployeesProps = result.data;
    softDeletedEmployeesProps.pop(); // remove owner props
    return this.mapper.toResponseAll(
      softDeletedEmployeeEntities,
      softDeletedEmployeesProps,
    );
  }
}
