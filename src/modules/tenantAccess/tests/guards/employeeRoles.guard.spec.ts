import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { TenantStatuses } from 'src/modules/tenants/domain/valueObjects/tenantStatus.vo';
import {
  EmployeeRolesGuard,
  EMPLOYEE_ROLES_METADATA,
  TENANT_OWNER_ONLY_METADATA,
} from '../../guards/employeeRoles.guard';

const context = {
  getHandler: () => function handler() {},
  getClass: () => class Controller {},
} as ExecutionContext;

function tenantContext(roles: EmployeeRoles[], isOwner = false) {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    tenantStatus: TenantStatuses.ACTIVE,
    employeeId: '33333333-3333-4333-8333-333333333333',
    roles,
    isOwner,
  };
}

describe('EmployeeRolesGuard', () => {
  afterEach(() => jest.restoreAllMocks());

  function reflectorReturning(metadataKey: string, value: unknown) {
    return {
      getAllAndOverride: jest.fn((key: string) =>
        key === metadataKey ? value : undefined,
      ),
    };
  }

  it('uses EmployeeRoles from the selected tenant employee', () => {
    const reflector = reflectorReturning(EMPLOYEE_ROLES_METADATA, [
      EmployeeRoles.Device_Dashboard,
    ]);
    const requireTenant = jest.spyOn(RequestContextService, 'requireTenant');
    const guard = new EmployeeRolesGuard(reflector as unknown as Reflector);

    requireTenant.mockReturnValue(
      tenantContext([EmployeeRoles.Device_Dashboard]),
    );
    expect(guard.canActivate(context)).toBe(true);

    requireTenant.mockReturnValue(tenantContext([EmployeeRoles.Only_View]));
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows the tenant owner without a synthetic owner role', () => {
    const reflector = reflectorReturning(EMPLOYEE_ROLES_METADATA, [
      EmployeeRoles.Employee,
    ]);
    jest
      .spyOn(RequestContextService, 'requireTenant')
      .mockReturnValue(tenantContext([], true));
    const guard = new EmployeeRolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks a non-owner employee from an owner-only route regardless of roles', () => {
    const reflector = reflectorReturning(TENANT_OWNER_ONLY_METADATA, true);
    jest
      .spyOn(RequestContextService, 'requireTenant')
      .mockReturnValue(
        tenantContext(
          [
            EmployeeRoles.Employee,
            EmployeeRoles.Wallet,
            EmployeeRoles.Device_Dashboard,
            EmployeeRoles.Only_View,
            EmployeeRoles.Report,
          ],
          false,
        ),
      );
    const guard = new EmployeeRolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows the tenant owner through an owner-only route', () => {
    const reflector = reflectorReturning(TENANT_OWNER_ONLY_METADATA, true);
    jest
      .spyOn(RequestContextService, 'requireTenant')
      .mockReturnValue(tenantContext([], true));
    const guard = new EmployeeRolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(context)).toBe(true);
  });
});
