import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Slug } from '../../domain/valueObjects/slug.vo';
import { TENANT_REPOSITORY } from '../../infra/tenant.diToken';
import { TenantRepository } from '../../infra/tenant.repository';

export class FindTenantBySlugQuery {
  readonly slug: string;

  constructor(slug: string) {
    this.slug = new Slug(slug).unpack();
  }
}

@QueryHandler(FindTenantBySlugQuery)
export class FindTenantBySlugQueryHandler implements IQueryHandler<FindTenantBySlugQuery> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    protected readonly tenantRepo: TenantRepository,
  ) {}

  async execute(query: FindTenantBySlugQuery) {
    return this.tenantRepo.findOne({ slug: query.slug });
  }
}
