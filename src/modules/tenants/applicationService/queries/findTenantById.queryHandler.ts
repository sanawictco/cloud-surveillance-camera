import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TENANT_REPOSITORY } from '../../infra/tenant.diToken';
import { TenantRepository } from '../../infra/tenant.repository';

export class FindTenantByIdQuery {
  constructor(public readonly id: string) {}
}

@QueryHandler(FindTenantByIdQuery)
export class FindTenantByIdQueryHandler implements IQueryHandler<FindTenantByIdQuery> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    protected readonly tenantRepo: TenantRepository,
  ) {}

  async execute(query: FindTenantByIdQuery) {
    return this.tenantRepo.findById(query.id);
  }
}
