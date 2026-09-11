import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateTenantRequestDto } from '../../contracts/createTenant.request.dto';

describe('CreateTenantRequestDto', () => {
  it('accepts a valid IANA timezone', () => {
    const dto = plainToInstance(CreateTenantRequestDto, {
      name: 'Sanaw Cloud',
      defaultTimezone: 'Asia/Tehran',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects a defaultTimezone that is not a real IANA timezone', () => {
    const dto = plainToInstance(CreateTenantRequestDto, {
      name: 'Sanaw Cloud',
      defaultTimezone: 'not-a-timezone',
    });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
