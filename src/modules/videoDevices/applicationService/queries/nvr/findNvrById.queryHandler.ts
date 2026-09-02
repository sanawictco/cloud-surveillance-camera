import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { buildTenantFilter } from 'src/modules/shared/tenantFilter';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';

export class FindNvrByIdForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindNvrByIdForTenantQuery)
export class FindNvrByIdForTenantQueryHandler implements IQueryHandler<FindNvrByIdForTenantQuery> {
  constructor(
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepo: NvrRepository,
  ) {}

  execute(query: FindNvrByIdForTenantQuery) {
    return this.nvrRepo.findOne(
      buildTenantFilter(query.tenantId, { id: query.id }),
    );
  }
}
