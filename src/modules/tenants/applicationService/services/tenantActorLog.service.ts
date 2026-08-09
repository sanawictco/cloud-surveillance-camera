import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { ActorLogApiService } from 'src/modules/actorLogs/applicationService/services/actorLogApi.service';

@Injectable()
export class TenantActorLogService {
  constructor(
    @Inject(forwardRef(() => ActorLogApiService))
    private readonly actorLogApiService: ActorLogApiService,
  ) {}

  async nameUpdated(name: string) {
    await this.actorLogApiService.registerActorLog({
      messageProps: {
        key: LanguageKeys.tenant.actorLog.nameUpdated,
        params: [name],
      },
    });
  }
}
