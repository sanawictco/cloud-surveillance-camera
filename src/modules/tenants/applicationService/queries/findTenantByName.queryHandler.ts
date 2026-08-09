import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TENANT_REPOSITORY } from '../../infra/tenant.diToken';
import { TenantRepository } from '../../infra/tenant.repository';

export class FindTenantByNameQuery {
  constructor(public readonly name: string) {}
}

@QueryHandler(FindTenantByNameQuery)
export class FindTenantByNameQueryHandler implements IQueryHandler<FindTenantByNameQuery> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    protected readonly tenantRepo: TenantRepository,
  ) {}

  async execute(query: FindTenantByNameQuery) {
    return this.tenantRepo.findOne({ name: query.name });
  }
}
