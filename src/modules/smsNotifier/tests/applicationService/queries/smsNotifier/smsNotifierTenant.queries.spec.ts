import { FindAllSmsNotifiersForTenantQuery } from '../../../../applicationService/queries/smsNotifier/findAllSmsNotifiers.queryHandler';
import {
  FindSmsNotifierByUserIdForTenantQuery,
  FindSmsNotifierByUserIdForTenantQueryHandler,
} from '../../../../applicationService/queries/smsNotifier/findSmsNotifierByUserId.queryHandler';

describe('SMS notifier tenant queries', () => {
  it('includes tenant in list filters', () => {
    const query = new FindAllSmsNotifiersForTenantQuery('tenant-a', [
      'shared-user',
    ]);

    expect(query.filter).toEqual({
      tenantId: 'tenant-a',
      userId: { $in: ['shared-user'] },
    });
  });

  it('finds a shared user notifier only inside the requested tenant', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(undefined) };
    const handler = new FindSmsNotifierByUserIdForTenantQueryHandler(
      repository as never,
    );

    await handler.execute(
      new FindSmsNotifierByUserIdForTenantQuery('tenant-a', 'shared-user'),
    );

    expect(repository.findOne).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      userId: 'shared-user',
    });
  });
});
