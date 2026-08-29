import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PAGE_REPOSITORY } from '../../infra/diTokens/page.diToken';
import { PageRepository } from '../../infra/repositories/page.repository';

export class FindPageByIdQuery {
  constructor(public readonly id: string) {
    this.id = id;
  }
}

export class FindPageByIdForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly nvrIds: string[],
    public readonly id: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindPageByIdQuery)
export class FindPageByIdQueryHandler implements IQueryHandler<FindPageByIdQuery> {
  constructor(
    @Inject(PAGE_REPOSITORY)
    protected readonly pageRepo: PageRepository,
  ) {}

  async execute(query: FindPageByIdQuery) {
    const record = await this.pageRepo.findById(query.id);
    return record;
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
    return this.pageRepo.findOne({
      $and: [{ id: query.id }, { nvrId: { $in: query.nvrIds } }],
    });
  }
}
