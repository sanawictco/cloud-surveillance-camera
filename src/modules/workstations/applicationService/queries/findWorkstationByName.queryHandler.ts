import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WORKSTATION_REPOSITORY } from '../../infra/workstation.diToken';
import { WorkstationRepository } from '../../infra/workstation.repository';

export class FindWorkstationByNameQuery {
  constructor(public readonly name: string) {
    this.name = name;
  }
}
@QueryHandler(FindWorkstationByNameQuery)
export class FindWorkstationByNameQueryHandler
  implements IQueryHandler<FindWorkstationByNameQuery>
{
  constructor(
    @Inject(WORKSTATION_REPOSITORY)
    protected readonly workstationRepo: WorkstationRepository,
  ) {}

  async execute(query: FindWorkstationByNameQuery) {
    const record = await this.workstationRepo.findOne({ name: query.name });
    return record;
  }
}
