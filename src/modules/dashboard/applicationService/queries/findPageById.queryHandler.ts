import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PAGE_REPOSITORY } from '../../infra/diTokens/page.diToken';
import { PageRepository } from '../../infra/repositories/page.repository';

export class FindPageByIdForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly nvrIds: string[],
    public readonly id: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindPageByIdForTenantQuery)
export class FindPageByIdForTenantQueryHandler implements IQueryHandler<FindPageByIdForTenantQuery> {
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepo: PageRepository,
  ) {}

  execute(query: FindPageByIdForTenantQuery) {
    if (query.nvrIds.length === 0) return Promise.resolve(undefined);
    return this.pageRepo.findOne(query.tenantId, {
      $and: [{ id: query.id }, { nvrId: { $in: query.nvrIds } }],
    });
  }
}
