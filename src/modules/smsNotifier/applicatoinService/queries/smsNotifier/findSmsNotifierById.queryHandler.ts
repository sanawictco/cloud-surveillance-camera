import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SMS_NOTIFIER_REPOSITORY } from 'src/modules/smsNotifier/infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from 'src/modules/smsNotifier/infra/repositories/smsNotifier.repository';

export class FindSmsNotifierByIdForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly userIds: string[],
    public readonly id: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindSmsNotifierByIdForTenantQuery)
export class FindSmsNotifierByIdForTenantQueryHandler implements IQueryHandler<FindSmsNotifierByIdForTenantQuery> {
  constructor(
    @Inject(SMS_NOTIFIER_REPOSITORY)
    private readonly smsNotifierRepo: SmsNotifierRepository,
  ) {}

  execute(query: FindSmsNotifierByIdForTenantQuery) {
    if (query.userIds.length === 0) return Promise.resolve(undefined);
    return this.smsNotifierRepo.findOne({
      $and: [
        { tenantId: query.tenantId },
        { id: query.id },
        { userId: { $in: query.userIds } },
      ],
    });
  }
}
