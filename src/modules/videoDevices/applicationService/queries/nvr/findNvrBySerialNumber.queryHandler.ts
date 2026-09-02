import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { Inject } from '@nestjs/common';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';

/**
 * Deliberately NOT tenant-scoped: this resolves an NVR during fog
 * authentication, before any tenant is known. The caller must verify the
 * NVR's accessToken and use the NVR's own tenantId for everything that
 * follows. Do not copy this shape for tenant-facing reads.
 */
export class FindNvrBySerialNumberQuery {
  constructor(public readonly serialNumber: string) {
    this.serialNumber = serialNumber;
  }
}
@QueryHandler(FindNvrBySerialNumberQuery)
export class FindNvrBySerialNumberQueryHandler
  implements IQueryHandler<FindNvrBySerialNumberQuery>
{
  constructor(
    @Inject(NVR_REPOSITORY)
    protected readonly nvrRepo: NvrRepository,
  ) {}

  async execute(query: FindNvrBySerialNumberQuery) {
    const record = await this.nvrRepo.findOne({
      serialNumber: query.serialNumber,
    });
    return record;
  }
}
