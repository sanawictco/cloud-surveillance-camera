import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SMS_NOTIFIER_REPOSITORY } from 'src/modules/employees/infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from 'src/modules/employees/infra/repositories/smsNotifier.repository';

export class FindSmsNotifierByUserIdQuery {
  constructor(public readonly userId: string) {
    this.userId = userId;
  }
}
@QueryHandler(FindSmsNotifierByUserIdQuery)
export class FindSmsNotifierByUserIdQueryHandler
  implements IQueryHandler<FindSmsNotifierByUserIdQuery>
{
  constructor(
    @Inject(SMS_NOTIFIER_REPOSITORY)
    protected readonly smsNotifierRepo: SmsNotifierRepository,
  ) {}

  async execute(query: FindSmsNotifierByUserIdQuery) {
    const record = await this.smsNotifierRepo.findOne({
      userId: query.userId,
    });
    return record;
  }
}
