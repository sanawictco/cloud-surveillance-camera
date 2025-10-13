import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SMS_NOTIFIER_REPOSITORY } from 'src/modules/employees/infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from 'src/modules/employees/infra/repositories/smsNotifier.repository';
import { QueryBase } from 'src/dddLib/applicationService';
interface SmsNotifierQueryFilter {}
export class FindAllSmsNotifiersQuery extends QueryBase<SmsNotifierQueryFilter> {}
@QueryHandler(FindAllSmsNotifiersQuery)
export class FindAllSmsNotifiersQueryHandler
  implements IQueryHandler<FindAllSmsNotifiersQuery>
{
  constructor(
    @Inject(SMS_NOTIFIER_REPOSITORY)
    protected readonly smsNotifierRepo: SmsNotifierRepository,
  ) {}

  async execute(query: FindAllSmsNotifiersQuery) {
    const records = await this.smsNotifierRepo.findAll(query);
    return records;
  }
}
