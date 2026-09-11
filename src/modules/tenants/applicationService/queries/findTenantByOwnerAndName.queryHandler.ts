import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TENANT_REPOSITORY } from '../../infra/tenant.diToken';
import { TenantRepository } from '../../infra/tenant.repository';

export class FindTenantByOwnerAndNameQuery {
  constructor(
    public readonly ownerId: string,
    public readonly name: string,
  ) {}
}

@QueryHandler(FindTenantByOwnerAndNameQuery)
export class FindTenantByOwnerAndNameQueryHandler
  implements IQueryHandler<FindTenantByOwnerAndNameQuery>
{
  constructor(
    @Inject(TENANT_REPOSITORY)
    protected readonly tenantRepo: TenantRepository,
  ) {}

  async execute(query: FindTenantByOwnerAndNameQuery) {
    return this.tenantRepo.findOne({
      ownerId: query.ownerId,
      name: query.name,
    });
  }
}
