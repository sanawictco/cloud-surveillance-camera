import {
  TenantStatus,
  TenantStatuses,
} from '../../../domain/valueObjects/tenantStatus.vo';

describe('TenantStatus', () => {
  it('accepts a supported tenant status', () => {
    expect(new TenantStatus(TenantStatuses.ACTIVE).unpack()).toBe(
      TenantStatuses.ACTIVE,
    );
  });

  it('rejects an unsupported tenant status', () => {
    expect(() => new TenantStatus('invalid' as TenantStatuses)).toThrow();
  });
});
