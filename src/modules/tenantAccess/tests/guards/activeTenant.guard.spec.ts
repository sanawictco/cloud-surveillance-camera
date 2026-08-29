import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { TenantStatuses } from 'src/modules/tenants/domain/valueObjects/tenantStatus.vo';
import { ActiveTenantGuard } from '../../guards/activeTenant.guard';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

function context(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ActiveTenantGuard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects a request without an authenticated user', async () => {
    const tenantAccess = { resolveActiveAccess: jest.fn() };
    const guard = new ActiveTenantGuard(tenantAccess as never);

    await expect(
      guard.canActivate(context({ headers: { 'x-tenant-id': tenantId } })),
    ).rejects.toThrow(UnauthorizedException);
    expect(tenantAccess.resolveActiveAccess).not.toHaveBeenCalled();
  });

  it('rejects a request without X-Tenant-Id', async () => {
    const tenantAccess = { resolveActiveAccess: jest.fn() };
    const guard = new ActiveTenantGuard(tenantAccess as never);

    await expect(
      guard.canActivate(context({ headers: {}, user: { id: userId } })),
    ).rejects.toThrow(BadRequestException);
    expect(tenantAccess.resolveActiveAccess).not.toHaveBeenCalled();
  });

  it('rejects a malformed X-Tenant-Id', async () => {
    const tenantAccess = { resolveActiveAccess: jest.fn() };
    const guard = new ActiveTenantGuard(tenantAccess as never);

    await expect(
      guard.canActivate(
        context({
          headers: { 'x-tenant-id': 'not-a-uuid' },
          user: { id: userId },
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an inactive or missing tenant employee', async () => {
    const tenantAccess = {
      resolveActiveAccess: jest.fn().mockResolvedValue(undefined),
    };
    const guard = new ActiveTenantGuard(tenantAccess as never);

    await expect(
      guard.canActivate(
        context({
          headers: { 'x-tenant-id': tenantId },
          user: { id: userId },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(tenantAccess.resolveActiveAccess).toHaveBeenCalledWith(
      tenantId,
      userId,
    );
  });

  it('stores only verified tenant access in request context', async () => {
    const access = {
      userId,
      tenantId,
      tenantStatus: TenantStatuses.ACTIVE,
      employeeId: '33333333-3333-4333-8333-333333333333',
      roles: [EmployeeRoles.Device_Dashboard],
      isOwner: false,
    };
    const tenantAccess = {
      resolveActiveAccess: jest.fn().mockResolvedValue(access),
    };
    const setTenant = jest
      .spyOn(RequestContextService, 'setTenant')
      .mockImplementation(() => undefined);
    const guard = new ActiveTenantGuard(tenantAccess as never);

    await expect(
      guard.canActivate(
        context({
          headers: { 'x-tenant-id': tenantId },
          user: { id: userId },
        }),
      ),
    ).resolves.toBe(true);
    expect(setTenant).toHaveBeenCalledWith(access);
  });
});
