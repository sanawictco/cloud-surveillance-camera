import { Injectable } from '@nestjs/common';
import { SanawApiEmployeeService } from 'src/extensions/sanawApi/services/sanawApiEmployee.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { EmployeeEntity } from '../../domain/entities/employee.entity';
import { EmployeeMapper } from '../../infra/mappers/employee.mapper';
import { FindAllEmployeesQuery } from '../queries/employee/findAllEmployees.queryHandler';

@Injectable()
export class EmployeeApiForTrashService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly mapper: EmployeeMapper,
    private readonly sanawApiEmployeeService: SanawApiEmployeeService,
  ) {}

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
