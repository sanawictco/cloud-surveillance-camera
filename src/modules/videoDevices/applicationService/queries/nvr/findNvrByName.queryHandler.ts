import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';

export class FindNvrByNameQuery {
  constructor(public readonly name: string) {
    this.name = name;
  }
}

export class FindNvrByNameForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly name: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindNvrByNameQuery)
export class FindNvrByNameQueryHandler implements IQueryHandler<FindNvrByNameQuery> {
  constructor(
    @Inject(NVR_REPOSITORY)
    protected readonly nvrRepo: NvrRepository,
  ) {}

  async execute(query: FindNvrByNameQuery) {
    const record = await this.nvrRepo.findOne({ name: query.name });
    return record;
  }
}

@QueryHandler(FindNvrByNameForTenantQuery)
export class FindNvrByNameForTenantQueryHandler implements IQueryHandler<FindNvrByNameForTenantQuery> {
  constructor(
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepo: NvrRepository,
  ) {}

  execute(query: FindNvrByNameForTenantQuery) {
    return this.nvrRepo.findOne({
      $and: [{ tenantId: query.tenantId }, { name: query.name }],
    });
  }
}
