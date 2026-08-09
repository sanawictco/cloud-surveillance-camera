import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { TenantEntity } from '../../domain/tenant.entity';
import { CreateTenantProps } from '../../domain/tenant.type';
import { TenantStatuses } from '../../domain/valueObjects/tenantStatus.vo';
import { TENANT_REPOSITORY } from '../../infra/tenant.diToken';
import { TenantRepository } from '../../infra/tenant.repository';

export class CreateTenantCommand extends Command implements CreateTenantProps {
  readonly ownerId: string;
  readonly name: string;
  readonly slug: string;
  readonly status: TenantStatuses;
  readonly defaultTimezone: string;

  constructor(props: CommandProps<CreateTenantCommand>) {
    super(props);
    this.ownerId = props.ownerId;
    this.name = props.name;
    this.slug = props.slug;
    this.status = props.status;
    this.defaultTimezone = props.defaultTimezone;
  }
}

@CommandHandler(CreateTenantCommand)
export class CreateTenantCommandHandler implements ICommandHandler<CreateTenantCommand> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    protected readonly tenantRepo: TenantRepository,
  ) {}

  async execute(command: CreateTenantCommand): Promise<AggregateID> {
    const tenant = TenantEntity.create({
      ownerId: command.ownerId,
      name: command.name,
      slug: command.slug,
      status: command.status,
      defaultTimezone: command.defaultTimezone,
    });
    await this.tenantRepo.insert(tenant);
    return tenant.id;
  }
}
