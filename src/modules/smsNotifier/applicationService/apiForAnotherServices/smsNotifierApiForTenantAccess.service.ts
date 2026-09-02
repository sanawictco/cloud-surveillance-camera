import { Inject, Injectable } from '@nestjs/common';
import { SMS_NOTIFIER_REPOSITORY } from '../../infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from '../../infra/repositories/smsNotifier.repository';

/**
 * Producer-side facade for the tenantAccess module. Removing an employee has
 * to drop that member's SMS subscription, which lives in this module.
 */
@Injectable()
export class SmsNotifierApiForTenantAccessService {
  constructor(
    @Inject(SMS_NOTIFIER_REPOSITORY)
    private readonly smsNotifierRepo: SmsNotifierRepository,
  ) {}

  /**
   * Drops the subscription a removed member held in this tenant. Silent when
   * there is none, since not every employee subscribes.
   */
  deleteForUser(tenantId: string, userId: string): Promise<void> {
    return this.smsNotifierRepo.deleteByUser(tenantId, userId);
  }
}
