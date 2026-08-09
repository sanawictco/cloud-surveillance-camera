import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { QueryBase } from 'src/dddLib/applicationService';
import { TenantStatuses } from '../../domain/valueObjects/tenantStatus.vo';
import { TENANT_REPOSITORY } from '../../infra/tenant.diToken';
import { TenantRepository } from '../../infra/tenant.repository';

interface TenantQueryFilter {
  ownerId: string;
  name: string | RegExp;
  slug: string;
  status: TenantStatuses;
}

export class FindAllTenantsQuery extends QueryBase<TenantQueryFilter> {}

@QueryHandler(FindAllTenantsQuery)
export class FindAllTenantsQueryHandler implements IQueryHandler<FindAllTenantsQuery> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    protected readonly tenantRepo: TenantRepository,
  ) {}

  async execute(query: FindAllTenantsQuery) {
    return this.tenantRepo.findAll(query);
  }
}
