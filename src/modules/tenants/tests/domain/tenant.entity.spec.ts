import { TenantEntity } from '../../domain/tenant.entity';
import { TenantStatuses } from '../../domain/valueObjects/tenantStatus.vo';

describe('TenantEntity', () => {
  it('creates a tenant with the requested ownership fields', () => {
    const tenant = TenantEntity.create({
      ownerId: '78c12077-7c5e-46f6-8a05-b3df96c94c2d',
      name: 'Sanaw',
      status: TenantStatuses.ACTIVE,
      defaultTimezone: 'Asia/Tehran',
    });

    expect(tenant.getProps()).toMatchObject({
      ownerId: '78c12077-7c5e-46f6-8a05-b3df96c94c2d',
      name: 'Sanaw',
      status: TenantStatuses.ACTIVE,
      defaultTimezone: 'Asia/Tehran',
    });
  });

  it('keeps owner ID immutable during updates', () => {
    const ownerId = '78c12077-7c5e-46f6-8a05-b3df96c94c2d';
    const tenant = TenantEntity.create({
      ownerId,
      name: 'Sanaw',
      status: TenantStatuses.ACTIVE,
      defaultTimezone: 'Asia/Tehran',
    });

    tenant.update({
      name: 'Sanaw Cloud',
    });

    expect(tenant.getProps().ownerId).toBe(ownerId);
  });
});
