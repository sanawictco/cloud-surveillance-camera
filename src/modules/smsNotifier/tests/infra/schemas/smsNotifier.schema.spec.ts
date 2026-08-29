import { SmsNotifierSchema } from '../../../infra/schemas/smsNotifier.schema';

describe('SmsNotifierSchema', () => {
  it('enforces one notifier per tenant and user', () => {
    const compoundIndex = SmsNotifierSchema.indexes().find(
      ([fields]) => fields.tenantId === 1 && fields.userId === 1,
    );

    expect(compoundIndex).toBeDefined();
    expect(compoundIndex?.[1]).toMatchObject({ unique: true });
  });
});
