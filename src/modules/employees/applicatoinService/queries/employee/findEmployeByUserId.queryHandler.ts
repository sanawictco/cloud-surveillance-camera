import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { EmployeeRepository } from '../../../infra/repositories/employee.repository';
import { EMPLOYEE_REPOSITORY } from '../../../infra/diTokens/employee.diToken';

export class FindEmployeeByUserIdQuery {
  constructor(public readonly userId: string) {
    this.userId = userId;
  }
}
@QueryHandler(FindEmployeeByUserIdQuery)
export class FindEmployeeByUserIdQueryHandler
  implements IQueryHandler<FindEmployeeByUserIdQuery>
{
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    protected readonly employeeRepo: EmployeeRepository,
  ) {}

  async execute(query: FindEmployeeByUserIdQuery) {
    const record = await this.employeeRepo.findOne({ userId: query.userId });
    return record;
  }
}
