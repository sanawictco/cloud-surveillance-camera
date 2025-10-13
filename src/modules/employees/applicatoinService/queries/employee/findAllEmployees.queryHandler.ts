import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { EMPLOYEE_REPOSITORY } from '../../../infra/diTokens/employee.diToken';
import { EmployeeRepository } from '../../../infra/repositories/employee.repository';
import { QueryBase } from 'src/dddLib/applicationService';
interface EmployeeQueryFilter {
  isDeleted: boolean;
}
export class FindAllEmployeesQuery extends QueryBase<EmployeeQueryFilter> {}
@QueryHandler(FindAllEmployeesQuery)
export class FindAllEmployeesQueryHandler
  implements IQueryHandler<FindAllEmployeesQuery>
{
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    protected readonly employeeRepo: EmployeeRepository,
  ) {}

  async execute(query: FindAllEmployeesQuery) {
    const records = await this.employeeRepo.findAll(query);
    return records;
  }
}
