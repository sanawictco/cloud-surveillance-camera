import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SMS_NOTIFIER_REPOSITORY } from 'src/modules/smsNotifier/infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from 'src/modules/smsNotifier/infra/repositories/smsNotifier.repository';
import { QueryBase } from 'src/dddLib/applicationService';
interface SmsNotifierQueryFilter {
  tenantId?: string;
  userId: string | { $in: string[] };
}
export class FindAllSmsNotifiersForTenantQuery extends QueryBase<SmsNotifierQueryFilter> {
  constructor(
    public readonly tenantId: string,
    public readonly userIds: string[],
  ) {
    super({ filter: { tenantId, userId: { $in: userIds } } });
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindAllSmsNotifiersForTenantQuery)
export class FindAllSmsNotifiersForTenantQueryHandler implements IQueryHandler<FindAllSmsNotifiersForTenantQuery> {
  constructor(
    @Inject(SMS_NOTIFIER_REPOSITORY)
    private readonly smsNotifierRepo: SmsNotifierRepository,
  ) {}

  execute(query: FindAllSmsNotifiersForTenantQuery) {
    if (query.userIds.length === 0) return Promise.resolve([]);
    return this.smsNotifierRepo.findAll(query);
  }
}
