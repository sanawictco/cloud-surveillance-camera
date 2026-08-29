import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PAGE_REPOSITORY } from '../../infra/diTokens/page.diToken';
import { PageRepository } from '../../infra/repositories/page.repository';
import { QueryBase, QueryBaseParams } from 'src/dddLib/applicationService';
import { PageProps } from '../../domain/page.type';

/**
 * Explicit cross-tenant page scan for platform/rule-engine flows only. Named
 * `AsSystem` so a missing tenant can never be silently treated as all tenants.
 */
export class FindAllPagesAsSystemQuery extends QueryBase<PageProps> {}

export class FindAllPagesForTenantQuery extends QueryBase<PageProps> {
  constructor(
    public readonly tenantId: string,
    public readonly nvrIds: string[],
    props?: QueryBaseParams<PageProps>,
  ) {
    super(props);
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindAllPagesAsSystemQuery)
export class FindAllPagesAsSystemQueryHandler
  implements IQueryHandler<FindAllPagesAsSystemQuery>
{
  constructor(
    @Inject(PAGE_REPOSITORY)
    protected readonly pageRepo: PageRepository,
  ) {}

  async execute(query: FindAllPagesAsSystemQuery) {
    return this.pageRepo.findAllAsSystem(query);
  }
}

@QueryHandler(FindAllPagesForTenantQuery)
export class FindAllPagesForTenantQueryHandler implements IQueryHandler<FindAllPagesForTenantQuery> {
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepo: PageRepository,
  ) {}

  execute(query: FindAllPagesForTenantQuery) {
    if (query.nvrIds.length === 0) return Promise.resolve([]);
    return this.pageRepo.findAll(query.tenantId, {
      filter: {
        $and: [{ nvrId: { $in: query.nvrIds } }, query.filter ?? {}],
      },
      orderBy: query.orderBy,
    });
  }
}
