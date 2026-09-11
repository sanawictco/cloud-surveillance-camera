import { TenantAccessRepository } from '../../infra/tenantAccess.repository';
import { TenantStatuses } from 'src/modules/tenants/domain/valueObjects/tenantStatus.vo';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '33333333-3333-4333-8333-333333333333';

function buildRepository() {
  const tenant = {
    id: tenantId,
    ownerId: userId,
    name: 'Sanaw',
    status: TenantStatuses.ACTIVE,
  };
  const tenantsApi = {
    findTenant: jest.fn().mockResolvedValue(tenant),
    findTenants: jest.fn().mockResolvedValue([tenant]),
    tenantExists: jest.fn().mockResolvedValue(true),
    findAllTenantIds: jest.fn().mockResolvedValue([tenantId]),
  };
  const smsNotifierApi = {
    deleteForUser: jest.fn().mockResolvedValue(undefined),
  };
  const repository = new TenantAccessRepository(
    tenantsApi as never,
    smsNotifierApi as never,
  );
  return { repository, tenantsApi, smsNotifierApi, tenant };
}

describe('TenantAccessRepository', () => {
  it('reads tenants through the tenants module facade', async () => {
    const { repository, tenantsApi, tenant } = buildRepository();

    await expect(repository.findTenant(tenantId)).resolves.toEqual(tenant);
    await expect(repository.findTenants([tenantId])).resolves.toEqual([tenant]);
    await expect(repository.tenantExists(tenantId)).resolves.toBe(true);
    await expect(repository.findAllTenantIds()).resolves.toEqual([tenantId]);

    expect(tenantsApi.findTenant).toHaveBeenCalledWith(tenantId);
    expect(tenantsApi.findTenants).toHaveBeenCalledWith([tenantId]);
  });

  it('clears a removed member SMS subscription through the smsNotifier facade', async () => {
    const { repository, smsNotifierApi } = buildRepository();

    await repository.deleteSmsNotifier(tenantId, userId);

    // Scoped to one tenant AND one user: a hard-deleted member must never
    // take another tenant's subscription with them.
    expect(smsNotifierApi.deleteForUser).toHaveBeenCalledWith(
      tenantId,
      userId,
    );
    expect(smsNotifierApi.deleteForUser).toHaveBeenCalledTimes(1);
  });
});
