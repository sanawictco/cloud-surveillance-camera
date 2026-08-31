import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { ActorLogApiService } from 'src/modules/actorLogs/applicationService/services/actorLogApi.service';

@Injectable()
export class EmployeesActorLogService {
  constructor(
    @Inject(forwardRef(() => ActorLogApiService))
    private readonly actorLogApiService: ActorLogApiService,
  ) {}

  async added(tenantId: string, phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      tenantId,
      messageProps: {
        key: LanguageKeys.employee.actorLog.added,
        params: [phoneNumber],
      },
    });
  }

  async rolesUpdated(tenantId: string, phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      tenantId,
      messageProps: {
        key: LanguageKeys.employee.actorLog.rolesUpdated,
        params: [phoneNumber],
      },
    });
  }

  async deleted(tenantId: string, phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      tenantId,
      messageProps: {
        key: LanguageKeys.employee.actorLog.deleted,
        params: [phoneNumber],
      },
    });
  }

  async softDeleted(tenantId: string, phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      tenantId,
      messageProps: {
        key: LanguageKeys.employee.actorLog.softDeleted,
        params: [phoneNumber],
      },
    });
  }

  async recovered(tenantId: string, phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      tenantId,
      messageProps: {
        key: LanguageKeys.employee.actorLog.recovered,
        params: [phoneNumber],
      },
    });
  }

  async smsNotifierAdded(tenantId: string, phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      tenantId,
      messageProps: {
        key: LanguageKeys.smsNotifier.actorLog.added,
        params: [phoneNumber],
      },
    });
  }

  async smsNotifierUpdated(tenantId: string, phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      tenantId,
      messageProps: {
        key: LanguageKeys.smsNotifier.actorLog.updated,
        params: [phoneNumber],
      },
    });
  }

  async smsNotifierDeleted(tenantId: string, phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      tenantId,
      messageProps: {
        key: LanguageKeys.smsNotifier.actorLog.deleted,
        params: [phoneNumber],
      },
    });
  }
}
