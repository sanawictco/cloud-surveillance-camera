import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';

export class FindNvrByIdQuery {
  constructor(public readonly id: string) {
    this.id = id;
  }
}

export class FindNvrByIdForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindNvrByIdQuery)
export class FindNvrByIdQueryHandler implements IQueryHandler<FindNvrByIdQuery> {
  constructor(
    @Inject(NVR_REPOSITORY)
    protected readonly nvrRepo: NvrRepository,
  ) {}

  async execute(query: FindNvrByIdQuery) {
    const record = await this.nvrRepo.findById(query.id);
    return record;
  }
}

@QueryHandler(FindNvrByIdForTenantQuery)
export class FindNvrByIdForTenantQueryHandler implements IQueryHandler<FindNvrByIdForTenantQuery> {
  constructor(
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepo: NvrRepository,
  ) {}

  execute(query: FindNvrByIdForTenantQuery) {
    return this.nvrRepo.findOne({
      $and: [{ tenantId: query.tenantId }, { id: query.id }],
    });
  }
}
