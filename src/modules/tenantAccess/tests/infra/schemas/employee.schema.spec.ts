import { EmployeeSchema } from 'src/modules/tenantAccess/infra/schemas/employee.schema';

describe('EmployeeSchema', () => {
  it('enforces one employee per tenant and user', () => {
    const compoundIndex = EmployeeSchema.indexes().find(
      ([fields]) => fields.tenantId === 1 && fields.userId === 1,
    );

    expect(compoundIndex).toBeDefined();
    expect(compoundIndex?.[1]).toMatchObject({ unique: true });
  });
});
