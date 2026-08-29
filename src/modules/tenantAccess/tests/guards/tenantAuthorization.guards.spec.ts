import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { TenantStatuses } from 'src/modules/tenants/domain/valueObjects/tenantStatus.vo';
import { EmployeeRolesGuard } from '../../guards/employeeRoles.guard';

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

  it('uses EmployeeRoles from the selected tenant employee', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([EmployeeRoles.Device_Dashboard]),
    };
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
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([EmployeeRoles.Employee]),
    };
    jest
      .spyOn(RequestContextService, 'requireTenant')
      .mockReturnValue(tenantContext([], true));
    const guard = new EmployeeRolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(context)).toBe(true);
  });
});
