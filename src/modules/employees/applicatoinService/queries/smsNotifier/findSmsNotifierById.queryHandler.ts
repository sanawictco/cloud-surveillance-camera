import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SMS_NOTIFIER_REPOSITORY } from 'src/modules/employees/infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from 'src/modules/employees/infra/repositories/smsNotifier.repository';

export class FindSmsNotifierByIdQuery {
  constructor(public readonly id: string) {
    this.id = id;
  }
}
@QueryHandler(FindSmsNotifierByIdQuery)
export class FindSmsNotifierByIdQueryHandler
  implements IQueryHandler<FindSmsNotifierByIdQuery>
{
  constructor(
    @Inject(SMS_NOTIFIER_REPOSITORY)
    protected readonly smsNotifierRepo: SmsNotifierRepository,
  ) {}

  async execute(query: FindSmsNotifierByIdQuery) {
    const record = await this.smsNotifierRepo.findById(query.id);
    return record;
  }
}
