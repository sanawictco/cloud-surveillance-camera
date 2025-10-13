import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { QueryBase } from 'src/dddLib/applicationService';
import { WORKSTATION_REPOSITORY } from '../../infra/workstation.diToken';
import { WorkstationRepository } from '../../infra/workstation.repository';
interface WorkstationQueryFilter {
  isDeleted: boolean;
}
export class FindAllWorkstationsQuery extends QueryBase<WorkstationQueryFilter> {}
@QueryHandler(FindAllWorkstationsQuery)
export class FindAllWorkstationsQueryHandler
  implements IQueryHandler<FindAllWorkstationsQuery>
{
  constructor(
    @Inject(WORKSTATION_REPOSITORY)
    protected readonly workstationRepo: WorkstationRepository,
  ) {}

  async execute(query: FindAllWorkstationsQuery) {
    const records = await this.workstationRepo.findAll(query);
    return records;
  }
}
