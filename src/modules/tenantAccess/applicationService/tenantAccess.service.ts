import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { EmployeeRecord } from 'src/modules/tenantAccess/domain/types/employee.type';
import { MyTenantResponseDto } from '../contracts/myTenant.response.dto';
import { VerifiedTenantContext } from '../domain/verifiedTenantContext';
import {
  CreateOwnerEmployeeCommand,
  CreateTenantEmployeeCommand,
  HardDeleteTenantEmployeeCommand,
  RecoverTenantEmployeeCommand,
  SoftDeleteTenantEmployeeCommand,
  UpdateTenantEmployeeRolesCommand,
} from './commands/tenantAccess.commands';
import {
  FindActiveEmployeeForUserQuery,
  FindAllActiveEmployeesAsSystemQuery,
  FindEmployeeForUserQuery,
  FindEmployeesForTenantQuery,
  FindMyTenantsQuery,
  IsTenantOwnerQuery,
  ResolveActiveTenantAccessQuery,
  TenantExistsQuery,
} from './queries/tenantAccess.queries';

@Injectable()
export class TenantAccessService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async resolveActiveAccess(
    tenantId: string,
    userId: string,
  ): Promise<VerifiedTenantContext | undefined> {
    return this.queryBus.execute(
      new ResolveActiveTenantAccessQuery(tenantId, userId),
    );
  }

  async findMyTenants(userId: string): Promise<MyTenantResponseDto[]> {
    return this.queryBus.execute(new FindMyTenantsQuery(userId));
  }

  findEmployeesForTenant(
    tenantId: string,
    includeDeleted = false,
  ): Promise<EmployeeRecord[]> {
    return this.queryBus.execute(
      new FindEmployeesForTenantQuery(tenantId, includeDeleted),
    );
  }

  findEmployeeForUser(
    tenantId: string,
    userId: string,
  ): Promise<EmployeeRecord | undefined> {
    return this.queryBus.execute(
      new FindEmployeeForUserQuery(tenantId, userId),
    );
  }

  async findActiveEmployeeForUser(
    tenantId: string,
    userId: string,
  ): Promise<EmployeeRecord | undefined> {
    return this.queryBus.execute(
      new FindActiveEmployeeForUserQuery(tenantId, userId),
    );
  }

  async isTenantOwner(tenantId: string, userId: string): Promise<boolean> {
    return this.queryBus.execute(new IsTenantOwnerQuery(tenantId, userId));
  }

  async tenantExists(tenantId: string): Promise<boolean> {
    return this.queryBus.execute(new TenantExistsQuery(tenantId));
  }

  async createEmployee(
    tenantId: string,
    userId: string,
    roles: EmployeeRoles[],
  ): Promise<EmployeeRecord> {
    return this.commandBus.execute(
      new CreateTenantEmployeeCommand(tenantId, userId, roles),
    );
  }

  async createOwnerEmployee(
    tenantId: string,
    userId: string,
  ): Promise<EmployeeRecord> {
    return this.commandBus.execute(
      new CreateOwnerEmployeeCommand(tenantId, userId),
    );
  }

  async updateEmployeeRoles(
    tenantId: string,
    employeeId: string,
    roles: EmployeeRoles[],
  ): Promise<EmployeeRecord> {
    return this.commandBus.execute(
      new UpdateTenantEmployeeRolesCommand(tenantId, employeeId, roles),
    );
  }

  async softDeleteEmployee(
    tenantId: string,
    employeeId: string,
  ): Promise<EmployeeRecord> {
    return this.commandBus.execute(
      new SoftDeleteTenantEmployeeCommand(tenantId, employeeId),
    );
  }

  async recoverEmployee(
    tenantId: string,
    employeeId: string,
  ): Promise<EmployeeRecord> {
    return this.commandBus.execute(
      new RecoverTenantEmployeeCommand(tenantId, employeeId),
    );
  }

  async hardDeleteEmployee(
    tenantId: string,
    employeeId: string,
  ): Promise<EmployeeRecord> {
    return this.commandBus.execute(
      new HardDeleteTenantEmployeeCommand(tenantId, employeeId),
    );
  }

  async findAllActiveEmployeesAsSystem(): Promise<EmployeeRecord[]> {
    return this.queryBus.execute(
      new FindAllActiveEmployeesAsSystemQuery(),
    );
  }
}
