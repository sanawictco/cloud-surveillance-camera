import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SMS_NOTIFIER_REPOSITORY } from 'src/modules/smsNotifier/infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from 'src/modules/smsNotifier/infra/repositories/smsNotifier.repository';

export class FindSmsNotifierByUserIdForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindSmsNotifierByUserIdForTenantQuery)
export class FindSmsNotifierByUserIdForTenantQueryHandler implements IQueryHandler<FindSmsNotifierByUserIdForTenantQuery> {
  constructor(
    @Inject(SMS_NOTIFIER_REPOSITORY)
    private readonly smsNotifierRepo: SmsNotifierRepository,
  ) {}

  execute(query: FindSmsNotifierByUserIdForTenantQuery) {
    return this.smsNotifierRepo.findOne({
      tenantId: query.tenantId,
      userId: query.userId,
    });
  }
}
