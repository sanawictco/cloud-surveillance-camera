import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Command } from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { TENANT_REPOSITORY } from '../../infra/tenant.diToken';
import { TenantRepository } from '../../infra/tenant.repository';

export class RestoreTenantsToCacheCommand extends Command {
  constructor() {
    super({ id: '' });
  }
}

@CommandHandler(RestoreTenantsToCacheCommand)
export class RestoreTenantsToCacheCommandHandler implements ICommandHandler<RestoreTenantsToCacheCommand> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    protected readonly tenantRepo: TenantRepository,
  ) {}

  async execute(command: RestoreTenantsToCacheCommand): Promise<AggregateID> {
    await this.tenantRepo.restoreAndInitRecordsToCache();
    return command.id;
  }
}
