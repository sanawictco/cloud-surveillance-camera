import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { WORKSTATION_REPOSITORY } from '../../infra/workstation.diToken';
import { WorkstationRepository } from '../../infra/workstation.repository';

export class FindWorkstationByIdQuery {
  constructor(public readonly id: string) {
    this.id = id;
  }
}
@QueryHandler(FindWorkstationByIdQuery)
export class FindWorkstationByIdQueryHandler
  implements IQueryHandler<FindWorkstationByIdQuery>
{
  constructor(
    @Inject(WORKSTATION_REPOSITORY)
    protected readonly workstationRepo: WorkstationRepository,
  ) {}

  async execute(query: FindWorkstationByIdQuery) {
    const record = await this.workstationRepo.findById(query.id);
    return record;
  }
}
