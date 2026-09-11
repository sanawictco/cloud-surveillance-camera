import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmployeeRecord } from 'src/modules/tenantAccess/domain/types/employee.type';
import { EmployeeRepository } from 'src/modules/tenantAccess/infra/repositories/employee.repository';
import { TenantStatuses } from 'src/modules/tenants/domain/valueObjects/tenantStatus.vo';
import { MyTenantResponseDto } from '../../contracts/myTenant.response.dto';
import { VerifiedTenantContext } from '../../domain/verifiedTenantContext';
import { TenantAccessRepository } from '../../infra/tenantAccess.repository';

export class ResolveActiveTenantAccessQuery {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
  ) {}
}

@QueryHandler(ResolveActiveTenantAccessQuery)
export class ResolveActiveTenantAccessQueryHandler implements IQueryHandler<ResolveActiveTenantAccessQuery> {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly tenantAccessRepository: TenantAccessRepository,
  ) {}

  async execute(
    query: ResolveActiveTenantAccessQuery,
  ): Promise<VerifiedTenantContext | undefined> {
    const [employee, tenant] = await Promise.all([
      this.employeeRepository.findActive(query.tenantId, query.userId),
      this.tenantAccessRepository.findTenant(query.tenantId),
    ]);
    if (!employee || !tenant || tenant.status !== TenantStatuses.ACTIVE) {
      return undefined;
    }
    return {
      userId: query.userId,
      tenantId: query.tenantId,
      tenantStatus: tenant.status,
      employeeId: employee.id,
      roles: employee.roles,
      isOwner: tenant.ownerId === query.userId,
    };
  }
}

export class FindMyTenantsQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(FindMyTenantsQuery)
export class FindMyTenantsQueryHandler implements IQueryHandler<FindMyTenantsQuery> {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly tenantAccessRepository: TenantAccessRepository,
  ) {}

  async execute(query: FindMyTenantsQuery): Promise<MyTenantResponseDto[]> {
    const employees = await this.employeeRepository.findForUser(query.userId);
    if (employees.length === 0) return [];
    const tenants = await this.tenantAccessRepository.findTenants(
      employees.map((employee) => employee.tenantId),
    );
    const tenantsById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
    const response: MyTenantResponseDto[] = [];
    for (const employee of employees) {
      const tenant = tenantsById.get(employee.tenantId);
      if (!tenant) continue;
      response.push(
        new MyTenantResponseDto({
          tenantId: tenant.id,
          name: tenant.name,
          status: tenant.status,
          employeeId: employee.id,
          roles: employee.roles,
          isOwner: tenant.ownerId === query.userId,
        }),
      );
    }
    return response;
  }
}

export class FindEmployeesForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly includeDeleted = false,
  ) {}
}

@QueryHandler(FindEmployeesForTenantQuery)
export class FindEmployeesForTenantQueryHandler implements IQueryHandler<FindEmployeesForTenantQuery> {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  execute(query: FindEmployeesForTenantQuery): Promise<EmployeeRecord[]> {
    return this.employeeRepository.findForTenant(
      query.tenantId,
      query.includeDeleted,
    );
  }
}

export class FindEmployeeForUserQuery {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
  ) {}
}

@QueryHandler(FindEmployeeForUserQuery)
export class FindEmployeeForUserQueryHandler implements IQueryHandler<FindEmployeeForUserQuery> {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  execute(query: FindEmployeeForUserQuery): Promise<EmployeeRecord | undefined> {
    return this.employeeRepository.findByUserForTenant(
      query.tenantId,
      query.userId,
    );
  }
}

export class FindActiveEmployeeForUserQuery extends FindEmployeeForUserQuery {}

@QueryHandler(FindActiveEmployeeForUserQuery)
export class FindActiveEmployeeForUserQueryHandler implements IQueryHandler<FindActiveEmployeeForUserQuery> {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly tenantAccessRepository: TenantAccessRepository,
  ) {}

  async execute(
    query: FindActiveEmployeeForUserQuery,
  ): Promise<EmployeeRecord | undefined> {
    const [employee, tenant] = await Promise.all([
      this.employeeRepository.findActive(query.tenantId, query.userId),
      this.tenantAccessRepository.findTenant(query.tenantId),
    ]);
    if (!employee || !tenant || tenant.status !== TenantStatuses.ACTIVE) {
      return undefined;
    }
    return employee;
  }
}

export class IsTenantOwnerQuery {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
  ) {}
}

@QueryHandler(IsTenantOwnerQuery)
export class IsTenantOwnerQueryHandler implements IQueryHandler<IsTenantOwnerQuery> {
  constructor(private readonly tenantAccessRepository: TenantAccessRepository) {}

  async execute(query: IsTenantOwnerQuery): Promise<boolean> {
    const tenant = await this.tenantAccessRepository.findTenant(query.tenantId);
    return tenant?.ownerId === query.userId;
  }
}

export class FindTenantOwnerIdQuery {
  constructor(public readonly tenantId: string) {}
}

@QueryHandler(FindTenantOwnerIdQuery)
export class FindTenantOwnerIdQueryHandler implements IQueryHandler<FindTenantOwnerIdQuery> {
  constructor(private readonly tenantAccessRepository: TenantAccessRepository) {}

  async execute(
    query: FindTenantOwnerIdQuery,
  ): Promise<string | undefined> {
    const tenant = await this.tenantAccessRepository.findTenant(query.tenantId);
    return tenant?.ownerId;
  }
}

export class TenantExistsQuery {
  constructor(public readonly tenantId: string) {}
}

@QueryHandler(TenantExistsQuery)
export class TenantExistsQueryHandler implements IQueryHandler<TenantExistsQuery> {
  constructor(private readonly tenantAccessRepository: TenantAccessRepository) {}

  execute(query: TenantExistsQuery): Promise<boolean> {
    return this.tenantAccessRepository.tenantExists(query.tenantId);
  }
}

export class FindAllActiveEmployeesAsSystemQuery {}

@QueryHandler(FindAllActiveEmployeesAsSystemQuery)
export class FindAllActiveEmployeesAsSystemQueryHandler implements IQueryHandler<FindAllActiveEmployeesAsSystemQuery> {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly tenantAccessRepository: TenantAccessRepository,
  ) {}

  async execute(): Promise<EmployeeRecord[]> {
    const tenantIds = await this.tenantAccessRepository.findAllTenantIds();
    const records = await Promise.all(
      tenantIds.map((tenantId) =>
        this.employeeRepository.findForTenant(tenantId),
      ),
    );
    return records.flat();
  }
}

export const tenantAccessQueryHandlers = [
  ResolveActiveTenantAccessQueryHandler,
  FindMyTenantsQueryHandler,
  FindEmployeesForTenantQueryHandler,
  FindEmployeeForUserQueryHandler,
  FindActiveEmployeeForUserQueryHandler,
  IsTenantOwnerQueryHandler,
  FindTenantOwnerIdQueryHandler,
  TenantExistsQueryHandler,
  FindAllActiveEmployeesAsSystemQueryHandler,
];
