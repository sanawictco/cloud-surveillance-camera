import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { EMPLOYEE_REPOSITORY } from '../../../infra/diTokens/employee.diToken';
import { EmployeeRepository } from '../../../infra/repositories/employee.repository';
import { QueryBase } from 'src/dddLib/applicationService';
interface EmployeeQueryFilter {
  userIds: string[];
}
export class FindAllExistingEmployeesByUserIdsQuery extends QueryBase<EmployeeQueryFilter> {}
@QueryHandler(FindAllExistingEmployeesByUserIdsQuery)
export class FindAllExistingEmployeesByUserIdsQueryHandler
  implements IQueryHandler<FindAllExistingEmployeesByUserIdsQuery>
{
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    protected readonly employeeRepo: EmployeeRepository,
  ) {}

  async execute(query: FindAllExistingEmployeesByUserIdsQuery) {
    const records = await this.employeeRepo.findAll({
      filter: {
        $and: [
          { isDeleted: false },
          { userId: { $in: query.filter?.userIds } },
        ],
      },
      orderBy: query.orderBy,
    });
    return records;
  }
}
