import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { TenantEntity } from '../../domain/tenant.entity';
import { TENANT_REPOSITORY } from '../../infra/tenant.diToken';
import { TenantRepository } from '../../infra/tenant.repository';

export class DeleteTenantCommand extends Command {
  constructor(props: CommandProps<DeleteTenantCommand> & IdType) {
    super(props);
  }
}

@CommandHandler(DeleteTenantCommand)
export class DeleteTenantCommandHandler implements ICommandHandler<DeleteTenantCommand> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    protected readonly tenantRepo: TenantRepository,
  ) {}

  async execute(command: DeleteTenantCommand): Promise<AggregateID> {
    const tenantEntity: TenantEntity | undefined =
      await this.tenantRepo.findById(command.id);
    if (!tenantEntity) throw new Error('entity not exists');
    tenantEntity.delete();
    await this.tenantRepo.update(tenantEntity);
    return command.id;
  }
}
