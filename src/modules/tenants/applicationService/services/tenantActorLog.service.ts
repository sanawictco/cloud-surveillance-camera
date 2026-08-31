import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { ActorLogApiService } from 'src/modules/actorLogs/applicationService/services/actorLogApi.service';

@Injectable()
export class TenantActorLogService {
  constructor(
    @Inject(forwardRef(() => ActorLogApiService))
    private readonly actorLogApiService: ActorLogApiService,
  ) {}

  /**
   * Logs a rename of `tenantId` itself. Tenant operations are
   * platform-authorized: the target tenant comes from the command, never from
   * ambient context or a request body.
   */
  async nameUpdated(tenantId: string, name: string) {
    await this.actorLogApiService.registerActorLog({
      tenantId,
      messageProps: {
        key: LanguageKeys.tenant.actorLog.nameUpdated,
        params: [name],
      },
    });
  }
}
