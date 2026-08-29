import { BadRequestException } from '@nestjs/common';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { TenantStatuses } from 'src/modules/tenants/domain/valueObjects/tenantStatus.vo';
import {
  SoftDeleteTenantEmployeeCommand,
  SoftDeleteTenantEmployeeCommandHandler,
} from '../../applicationService/commands/tenantAccess.commands';
import {
  FindActiveEmployeeForUserQuery,
  FindActiveEmployeeForUserQueryHandler,
  FindMyTenantsQuery,
  FindMyTenantsQueryHandler,
  ResolveActiveTenantAccessQuery,
  ResolveActiveTenantAccessQueryHandler,
} from '../../applicationService/queries/tenantAccess.queries';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

describe('TenantAccess authorization', () => {
  it('resolves employee access from authoritative records', async () => {
    const employee = {
      id: '33333333-3333-4333-8333-333333333333',
      tenantId,
      userId,
      roles: [EmployeeRoles.Report],
      isDeleted: false,
    };
    const employeeRepository = {
      findActive: jest.fn().mockResolvedValue(employee),
    };
    const tenantAccessRepository = {
      findTenant: jest.fn().mockResolvedValue({
        id: tenantId,
        ownerId: 'another-user',
        status: TenantStatuses.ACTIVE,
      }),
    };
    const handler = new ResolveActiveTenantAccessQueryHandler(
      employeeRepository as never,
      tenantAccessRepository as never,
    );

    await expect(
      handler.execute(new ResolveActiveTenantAccessQuery(tenantId, userId)),
    ).resolves.toEqual(
      expect.objectContaining({
        userId,
        tenantId,
        employeeId: employee.id,
        roles: [EmployeeRoles.Report],
        isOwner: false,
      }),
    );
    expect(employeeRepository.findActive).toHaveBeenCalledWith(
      tenantId,
      userId,
    );
  });

  it('lists the same user employees with tenant-specific roles', async () => {
    const tenantB = '44444444-4444-4444-8444-444444444444';
    const employeeRepository = {
      findForUser: jest.fn().mockResolvedValue([
        {
          id: 'employee-a',
          tenantId,
          roles: [EmployeeRoles.Device_Dashboard],
        },
        {
          id: 'employee-b',
          tenantId: tenantB,
          roles: [EmployeeRoles.Only_View],
        },
      ]),
    };
    const tenantAccessRepository = {
      findTenants: jest.fn().mockResolvedValue([
        {
          id: tenantId,
          ownerId: 'another-user',
          name: 'Tenant A',
          slug: 'tenant-a',
          status: TenantStatuses.ACTIVE,
        },
        {
          id: tenantB,
          ownerId: userId,
          name: 'Tenant B',
          slug: 'tenant-b',
          status: TenantStatuses.ACTIVE,
        },
      ]),
    };
    const handler = new FindMyTenantsQueryHandler(
      employeeRepository as never,
      tenantAccessRepository as never,
    );

    await expect(
      handler.execute(new FindMyTenantsQuery(userId)),
    ).resolves.toEqual([
      expect.objectContaining({
        tenantId,
        employeeId: 'employee-a',
        roles: [EmployeeRoles.Device_Dashboard],
        isOwner: false,
      }),
      expect.objectContaining({
        tenantId: tenantB,
        employeeId: 'employee-b',
        roles: [EmployeeRoles.Only_View],
        isOwner: true,
      }),
    ]);
  });

  it('rejects deleted employees and inactive tenants for device flows', async () => {
    const employeeRepository = {
      findActive: jest.fn().mockResolvedValue(undefined),
    };
    const tenantAccessRepository = {
      findTenant: jest
        .fn()
        .mockResolvedValue({ status: TenantStatuses.ACTIVE }),
    };
    const handler = new FindActiveEmployeeForUserQueryHandler(
      employeeRepository as never,
      tenantAccessRepository as never,
    );

    await expect(
      handler.execute(new FindActiveEmployeeForUserQuery(tenantId, userId)),
    ).resolves.toBeUndefined();
    expect(employeeRepository.findActive).toHaveBeenCalledWith(
      tenantId,
      userId,
    );
  });

  it('removes one tenant employee and its SMS notifier preference', async () => {
    const employeeRepository = {
      findByIdForTenant: jest.fn().mockResolvedValue({
        id: 'employee-id',
        tenantId,
        userId,
        roles: [EmployeeRoles.Only_View],
        isDeleted: false,
      }),
      setDeleted: jest.fn().mockResolvedValue({
        id: 'employee-id',
        tenantId,
        userId,
        roles: [EmployeeRoles.Only_View],
        isDeleted: true,
      }),
    };
    const tenantAccessRepository = {
      findTenant: jest.fn().mockResolvedValue({ ownerId: 'another-user' }),
      deleteSmsNotifier: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new SoftDeleteTenantEmployeeCommandHandler(
      employeeRepository as never,
      tenantAccessRepository as never,
    );

    await handler.execute(
      new SoftDeleteTenantEmployeeCommand(tenantId, 'employee-id'),
    );

    expect(employeeRepository.setDeleted).toHaveBeenCalledWith(
      tenantId,
      'employee-id',
      true,
    );
    expect(tenantAccessRepository.deleteSmsNotifier).toHaveBeenCalledWith(
      tenantId,
      userId,
    );
  });

  it('rejects changes to the tenant owner employee', async () => {
    const employeeRepository = {
      findByIdForTenant: jest.fn().mockResolvedValue({
        id: 'employee-id',
        tenantId,
        userId,
        roles: [],
        isDeleted: false,
      }),
      setDeleted: jest.fn(),
    };
    const tenantAccessRepository = {
      findTenant: jest.fn().mockResolvedValue({ ownerId: userId }),
      deleteSmsNotifier: jest.fn(),
    };
    const handler = new SoftDeleteTenantEmployeeCommandHandler(
      employeeRepository as never,
      tenantAccessRepository as never,
    );

    await expect(
      handler.execute(
        new SoftDeleteTenantEmployeeCommand(tenantId, 'employee-id'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(employeeRepository.setDeleted).not.toHaveBeenCalled();
  });
});
