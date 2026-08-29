import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { QueryBase, QueryBaseParams } from 'src/dddLib/applicationService';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';
interface NvrQueryFilter {
  tenantId: string;
  name: string | RegExp;
  isActive: boolean;
}

interface NvrTenantQueryFilter {
  name: string | RegExp;
  isActive: boolean;
}

export class FindAllNvrsQuery extends QueryBase<NvrQueryFilter> {}

export class FindAllNvrsForTenantQuery extends QueryBase<NvrTenantQueryFilter> {
  constructor(
    public readonly tenantId: string,
    props?: QueryBaseParams<NvrTenantQueryFilter>,
  ) {
    super(props);
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindAllNvrsQuery)
export class FindAllNvrsQueryHandler implements IQueryHandler<FindAllNvrsQuery> {
  constructor(
    @Inject(NVR_REPOSITORY)
    protected readonly nvrRepo: NvrRepository,
  ) {}

  async execute(query: FindAllNvrsQuery) {
    const records = await this.nvrRepo.findAll(query);
    return records;
  }
}

@QueryHandler(FindAllNvrsForTenantQuery)
export class FindAllNvrsForTenantQueryHandler implements IQueryHandler<FindAllNvrsForTenantQuery> {
  constructor(
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepo: NvrRepository,
  ) {}

  execute(query: FindAllNvrsForTenantQuery) {
    return this.nvrRepo.findAll({
      filter: { $and: [{ tenantId: query.tenantId }, query.filter ?? {}] },
      orderBy: query.orderBy,
    });
  }
}
