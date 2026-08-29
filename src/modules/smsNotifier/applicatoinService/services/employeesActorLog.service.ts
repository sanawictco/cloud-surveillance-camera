import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { ActorLogApiService } from 'src/modules/actorLogs/applicationService/services/actorLogApi.service';

@Injectable()
export class EmployeesActorLogService {
  constructor(
    @Inject(forwardRef(() => ActorLogApiService))
    private readonly actorLogApiService: ActorLogApiService,
  ) {}

  async added(phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      messageProps: {
        key: LanguageKeys.employee.actorLog.added,
        params: [phoneNumber],
      },
    });
  }

  async rolesUpdated(phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      messageProps: {
        key: LanguageKeys.employee.actorLog.rolesUpdated,
        params: [phoneNumber],
      },
    });
  }

  async deleted(phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      messageProps: {
        key: LanguageKeys.employee.actorLog.deleted,
        params: [phoneNumber],
      },
    });
  }

  async softDeleted(phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      messageProps: {
        key: LanguageKeys.employee.actorLog.softDeleted,
        params: [phoneNumber],
      },
    });
  }

  async recovered(phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      messageProps: {
        key: LanguageKeys.employee.actorLog.recovered,
        params: [phoneNumber],
      },
    });
  }

  async smsNotifierAdded(phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      messageProps: {
        key: LanguageKeys.smsNotifier.actorLog.added,
        params: [phoneNumber],
      },
    });
  }

  async smsNotifierUpdated(phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      messageProps: {
        key: LanguageKeys.smsNotifier.actorLog.updated,
        params: [phoneNumber],
      },
    });
  }

  async smsNotifierDeleted(phoneNumber: string) {
    await this.actorLogApiService.registerActorLog({
      messageProps: {
        key: LanguageKeys.smsNotifier.actorLog.deleted,
        params: [phoneNumber],
      },
    });
  }
}
