import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PAGE_REPOSITORY } from '../../infra/diTokens/page.diToken';
import { PageRepository } from '../../infra/repositories/page.repository';

export class FindPageByNameAndNvrIdForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly nvrIds: string[],
    public readonly name: string,
    public readonly nvrId: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindPageByNameAndNvrIdForTenantQuery)
export class FindPageByNameAndNvrIdForTenantQueryHandler implements IQueryHandler<FindPageByNameAndNvrIdForTenantQuery> {
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepo: PageRepository,
  ) {}

  execute(query: FindPageByNameAndNvrIdForTenantQuery) {
    if (!query.nvrIds.includes(query.nvrId)) return Promise.resolve(undefined);
    return this.pageRepo.findOne(query.tenantId, {
      name: query.name,
      nvrId: query.nvrId,
    });
  }
}
