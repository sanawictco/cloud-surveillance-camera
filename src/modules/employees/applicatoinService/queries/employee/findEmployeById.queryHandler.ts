import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Query } from '@nestjs/common';
import { EmployeeRepository } from '../../../infra/repositories/employee.repository';
import { EMPLOYEE_REPOSITORY } from '../../../infra/diTokens/employee.diToken';

export class FindEmployeeByIdQuery {
  constructor(public readonly id: string) {
    this.id = id;
  }
}
@QueryHandler(FindEmployeeByIdQuery)
export class FindEmployeeByIdQueryHandler
  implements IQueryHandler<FindEmployeeByIdQuery>
{
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    protected readonly employeeRepo: EmployeeRepository,
  ) {}

  async execute(query: FindEmployeeByIdQuery) {
    const record = await this.employeeRepo.findById(query.id);
    return record;
  }
}
