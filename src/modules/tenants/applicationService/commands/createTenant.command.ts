import { Inject, Logger } from '@nestjs/common';
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
import { TenantAccessService } from 'src/modules/tenantAccess/applicationService/tenantAccess.service';

export class CreateTenantCommand extends Command implements CreateTenantProps {
  readonly ownerId: string;
  readonly name: string;
  readonly status: TenantStatuses;
  readonly defaultTimezone: string;

  constructor(props: CommandProps<CreateTenantCommand>) {
    super(props);
    this.ownerId = props.ownerId;
    this.name = props.name;
    this.status = props.status;
    this.defaultTimezone = props.defaultTimezone;
  }
}

@CommandHandler(CreateTenantCommand)
export class CreateTenantCommandHandler implements ICommandHandler<CreateTenantCommand> {
  private readonly logger = new Logger(CreateTenantCommandHandler.name);

  constructor(
    @Inject(TENANT_REPOSITORY)
    protected readonly tenantRepo: TenantRepository,
    private readonly tenantAccessService: TenantAccessService,
  ) {}

  async execute(command: CreateTenantCommand): Promise<AggregateID> {
    const tenant = TenantEntity.create({
      ownerId: command.ownerId,
      name: command.name,
      status: command.status,
      defaultTimezone: command.defaultTimezone,
    });
    await this.tenantRepo.insert(tenant);
    try {
      await this.tenantAccessService.createOwnerEmployee(
        tenant.id,
        command.ownerId,
      );
    } catch (error) {
      // A tenant without its owner employee is unreachable: ActiveTenantGuard
      // resolves access from the employee record and there is no self-service
      // way to create the first one. Roll the tenant back so the caller can
      // retry instead of being left with a permanently locked-out tenant.
      await this.rollbackTenant(tenant);
      throw error;
    }
    return tenant.id;
  }

  private async rollbackTenant(tenant: TenantEntity): Promise<void> {
    try {
      await this.tenantRepo.delete(tenant);
    } catch (rollbackError) {
      // Never mask the original failure; surface the orphan for operators.
      this.logger.error(
        `failed to roll back tenant ${tenant.id} after owner-employee creation failed; tenant is orphaned and has no employees`,
        (rollbackError as Error)?.stack,
      );
    }
  }
}
