import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { EmployeeRecord } from 'src/modules/tenantAccess/domain/types/employee.type';
import { EmployeeRepository } from 'src/modules/tenantAccess/infra/repositories/employee.repository';
import { TenantAccessRepository } from '../../infra/tenantAccess.repository';
import { ActorLogApiService } from 'src/modules/actorLogs/applicationService/services/actorLogApi.service';

async function requireMutableEmployee(
  employeeRepository: EmployeeRepository,
  tenantAccessRepository: TenantAccessRepository,
  tenantId: string,
  employeeId: string,
): Promise<EmployeeRecord> {
  const [employee, tenant] = await Promise.all([
    employeeRepository.findByIdForTenant(tenantId, employeeId),
    tenantAccessRepository.findTenant(tenantId),
  ]);
  if (!employee || !tenant) {
    throw new BadRequestException('employee does not exist');
  }
  if (employee.userId === tenant.ownerId) {
    throw new BadRequestException('tenant owner employee cannot be changed');
  }
  return employee;
}

export class CreateTenantEmployeeCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly roles: EmployeeRoles[],
  ) {}
}

@CommandHandler(CreateTenantEmployeeCommand)
export class CreateTenantEmployeeCommandHandler implements ICommandHandler<CreateTenantEmployeeCommand> {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly tenantAccessRepository: TenantAccessRepository,
  ) {}

  async execute(command: CreateTenantEmployeeCommand): Promise<EmployeeRecord> {
    if (!(await this.tenantAccessRepository.tenantExists(command.tenantId))) {
      throw new BadRequestException('tenant does not exist');
    }
    return this.employeeRepository.save(
      command.tenantId,
      command.userId,
      command.roles,
    );
  }
}

export class CreateOwnerEmployeeCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
  ) {}
}

@CommandHandler(CreateOwnerEmployeeCommand)
export class CreateOwnerEmployeeCommandHandler implements ICommandHandler<CreateOwnerEmployeeCommand> {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  execute(command: CreateOwnerEmployeeCommand): Promise<EmployeeRecord> {
    return this.employeeRepository.save(command.tenantId, command.userId, []);
  }
}

export class UpdateTenantEmployeeRolesCommand {
  constructor(
    public readonly tenantId: string,
    public readonly employeeId: string,
    public readonly roles: EmployeeRoles[],
  ) {}
}

@CommandHandler(UpdateTenantEmployeeRolesCommand)
export class UpdateTenantEmployeeRolesCommandHandler implements ICommandHandler<UpdateTenantEmployeeRolesCommand> {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly tenantAccessRepository: TenantAccessRepository,
  ) {}

  async execute(
    command: UpdateTenantEmployeeRolesCommand,
  ): Promise<EmployeeRecord> {
    await requireMutableEmployee(
      this.employeeRepository,
      this.tenantAccessRepository,
      command.tenantId,
      command.employeeId,
    );
    const updated = await this.employeeRepository.updateRoles(
      command.tenantId,
      command.employeeId,
      command.roles,
    );
    if (!updated) throw new BadRequestException('employee does not exist');
    return updated;
  }
}

export class SoftDeleteTenantEmployeeCommand {
  constructor(
    public readonly tenantId: string,
    public readonly employeeId: string,
  ) {}
}

@CommandHandler(SoftDeleteTenantEmployeeCommand)
export class SoftDeleteTenantEmployeeCommandHandler implements ICommandHandler<SoftDeleteTenantEmployeeCommand> {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly tenantAccessRepository: TenantAccessRepository,
  ) {}

  async execute(
    command: SoftDeleteTenantEmployeeCommand,
  ): Promise<EmployeeRecord> {
    await requireMutableEmployee(
      this.employeeRepository,
      this.tenantAccessRepository,
      command.tenantId,
      command.employeeId,
    );
    const deleted = await this.employeeRepository.setDeleted(
      command.tenantId,
      command.employeeId,
      true,
    );
    if (!deleted) throw new BadRequestException('employee does not exist');
    await this.tenantAccessRepository.deleteSmsNotifier(
      command.tenantId,
      deleted.userId,
    );
    return deleted;
  }
}

export class RecoverTenantEmployeeCommand extends SoftDeleteTenantEmployeeCommand {}

@CommandHandler(RecoverTenantEmployeeCommand)
export class RecoverTenantEmployeeCommandHandler implements ICommandHandler<RecoverTenantEmployeeCommand> {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  async execute(
    command: RecoverTenantEmployeeCommand,
  ): Promise<EmployeeRecord> {
    const employee = await this.employeeRepository.findByIdForTenant(
      command.tenantId,
      command.employeeId,
    );
    if (!employee) throw new BadRequestException('employee does not exist');
    const recovered = await this.employeeRepository.setDeleted(
      command.tenantId,
      command.employeeId,
      false,
    );
    if (!recovered) throw new BadRequestException('employee does not exist');
    return recovered;
  }
}

export class HardDeleteTenantEmployeeCommand extends SoftDeleteTenantEmployeeCommand {}

@CommandHandler(HardDeleteTenantEmployeeCommand)
export class HardDeleteTenantEmployeeCommandHandler implements ICommandHandler<HardDeleteTenantEmployeeCommand> {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly tenantAccessRepository: TenantAccessRepository,
    private readonly actorLogApiService: ActorLogApiService,
  ) {}

  async execute(
    command: HardDeleteTenantEmployeeCommand,
  ): Promise<EmployeeRecord> {
    const employee = await requireMutableEmployee(
      this.employeeRepository,
      this.tenantAccessRepository,
      command.tenantId,
      command.employeeId,
    );
    if (!employee.isDeleted) {
      throw new BadRequestException(
        'only a removed employee can be permanently deleted',
      );
    }
    const deleted = await this.employeeRepository.delete(
      command.tenantId,
      command.employeeId,
    );
    if (!deleted) throw new BadRequestException('employee does not exist');
    await this.tenantAccessRepository.deleteSmsNotifier(
      command.tenantId,
      employee.userId,
    );
    // Per-member actor-log hard delete: row-deletes this user's events from
    // this tenant's child table only. The same SSO user's records in other
    // tenants are separate child tables and remain untouched.
    await this.actorLogApiService.deleteActorLogs(command.tenantId, [
      employee.userId,
    ]);
    return employee;
  }
}

export const tenantAccessCommandHandlers = [
  CreateTenantEmployeeCommandHandler,
  CreateOwnerEmployeeCommandHandler,
  UpdateTenantEmployeeRolesCommandHandler,
  SoftDeleteTenantEmployeeCommandHandler,
  RecoverTenantEmployeeCommandHandler,
  HardDeleteTenantEmployeeCommandHandler,
];
