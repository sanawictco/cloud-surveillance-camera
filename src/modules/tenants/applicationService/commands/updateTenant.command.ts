import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { TenantEntity } from '../../domain/tenant.entity';
import { UpdateTenantProps } from '../../domain/tenant.type';
import { TenantStatuses } from '../../domain/valueObjects/tenantStatus.vo';
import { TENANT_REPOSITORY } from '../../infra/tenant.diToken';
import { TenantRepository } from '../../infra/tenant.repository';
import { TenantActorLogService } from '../services/tenantActorLog.service';

export class UpdateTenantCommand extends Command implements UpdateTenantProps {
  readonly name?: string;
  readonly slug?: string;
  readonly status?: TenantStatuses;
  readonly defaultTimezone?: string;

  constructor(props: CommandProps<UpdateTenantCommand> & IdType) {
    super(props);
    this.name = props.name;
    this.slug = props.slug;
    this.status = props.status;
    this.defaultTimezone = props.defaultTimezone;
  }
}

@CommandHandler(UpdateTenantCommand)
export class UpdateTenantCommandHandler implements ICommandHandler<UpdateTenantCommand> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    protected readonly tenantRepo: TenantRepository,
    protected readonly tenantActorLogService: TenantActorLogService,
  ) {}

  async execute(command: UpdateTenantCommand): Promise<AggregateID> {
    const tenantEntity: TenantEntity | undefined =
      await this.tenantRepo.findById(command.id);
    if (!tenantEntity) throw new Error('entity not exists');

    tenantEntity.update({
      name: command.name,
      slug: command.slug,
      status: command.status,
      defaultTimezone: command.defaultTimezone,
    });
    await this.tenantRepo.update(tenantEntity);
    if (command.name)
      await this.tenantActorLogService.nameUpdated(command.name);
    return command.id;
  }
}
