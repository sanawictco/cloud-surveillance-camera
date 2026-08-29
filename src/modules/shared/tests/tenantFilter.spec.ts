import { buildTenantFilter } from '../tenantFilter';

describe('buildTenantFilter', () => {
  it('merges tenant ownership and caller filter with $and', () => {
    expect(buildTenantFilter('tenant-a', { id: 'page-1' })).toEqual({
      $and: [{ tenantId: 'tenant-a' }, { id: 'page-1' }],
    });
  });

  it('defaults the caller filter to an empty object', () => {
    expect(buildTenantFilter('tenant-a')).toEqual({
      $and: [{ tenantId: 'tenant-a' }, {}],
    });
  });

  it('cannot be overridden by a caller tenantId', () => {
    const filter = buildTenantFilter('tenant-a', { tenantId: 'tenant-b' });

    // The trusted tenant remains the first, unavoidable predicate; a hostile
    // caller tenantId is only an additional constraint, never a replacement.
    expect(filter.$and[0]).toEqual({ tenantId: 'tenant-a' });
    expect(filter.$and[1]).toEqual({ tenantId: 'tenant-b' });
  });

  it('fails closed when tenant is missing', () => {
    expect(() => buildTenantFilter('')).toThrow('tenantId is required');
  });
});
