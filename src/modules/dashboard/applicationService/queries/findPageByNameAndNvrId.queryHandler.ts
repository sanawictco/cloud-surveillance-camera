import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PAGE_REPOSITORY } from '../../infra/diTokens/page.diToken';
import { PageRepository } from '../../infra/repositories/page.repository';

export class FindPageByNameAndNvrIdQuery {
  constructor(
    public readonly name: string,
    public readonly nvrId: string,
  ) {
    this.name = name;
    this.nvrId = nvrId;
  }
}

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
@QueryHandler(FindPageByNameAndNvrIdQuery)
export class FindPageByNameAndNvrIdQueryHandler implements IQueryHandler<FindPageByNameAndNvrIdQuery> {
  constructor(
    @Inject(PAGE_REPOSITORY)
    protected readonly pageRepo: PageRepository,
  ) {}

  async execute(query: FindPageByNameAndNvrIdQuery) {
    const record = await this.pageRepo.findOne({
      name: query.name,
      nvrId: query.nvrId,
    });
    return record;
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
    return this.pageRepo.findOne({ name: query.name, nvrId: query.nvrId });
  }
}
