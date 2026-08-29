import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PAGE_REPOSITORY } from '../../infra/diTokens/page.diToken';
import { PageRepository } from '../../infra/repositories/page.repository';
import { QueryBase, QueryBaseParams } from 'src/dddLib/applicationService';
import { PageProps } from '../../domain/page.type';

export class FindAllPagesQuery extends QueryBase<PageProps> {}

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
@QueryHandler(FindAllPagesQuery)
export class FindAllPagesQueryHandler implements IQueryHandler<FindAllPagesQuery> {
  constructor(
    @Inject(PAGE_REPOSITORY)
    protected readonly pageRepo: PageRepository,
  ) {}

  async execute(query: FindAllPagesQuery) {
    const records = await this.pageRepo.findAll(query);
    return records;
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
    return this.pageRepo.findAll({
      filter: {
        $and: [{ nvrId: { $in: query.nvrIds } }, query.filter ?? {}],
      },
      orderBy: query.orderBy,
    });
  }
}
