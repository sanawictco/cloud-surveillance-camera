import { BadRequestException, Injectable } from '@nestjs/common';

import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { PageEntity } from '../../domain/page.entity';
import { PageConfigs, UpdatePageProps } from '../../domain/page.type';
import { UpdatePageCommand } from '../commands/updatePage.command';
import { FindPageByIdForTenantQuery } from '../queries/findPageById.queryHandler';
import { PageConfigQueueService } from './queues/pageConfigQueue.service';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';
import { UnlockPageRunningConfigCommand } from '../commands/unlockPageRunningConfig.command';

@Injectable()
export class PageRunningConfigService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly pageConfigQueueService: PageConfigQueueService,
  ) {}

  async runConfigIfNotDuplicated(
    pageEntity: PageEntity,
    tenantId: string,
    configType: PageConfigs,
    data?: UpdatePageProps,
  ): Promise<string> {
    if (await this.isConfigRunning(pageEntity, tenantId, configType)) {
      if (RequestContextService.getContext())
        throw new BadRequestException(
          this.serviceProvider.translatorService.translateByName(
            LanguageKeys.others.errorResponse.badRequest.configIsRunning,
            this.serviceProvider.userInfoService.getProps().lang,
          ),
        );
      return '';
    } else {
      const msgId = await this.pageConfigQueueService.addRepeatableMsg(
        pageEntity.getConfigForFog(tenantId, configType, data),
      );
      await this.runAndLockConfig(pageEntity, tenantId, configType, msgId);
      return msgId;
    }
  }

  async doneAndUnLockConfig(
    pageEntity: PageEntity | undefined,
    tenantId: string,
    configType: PageConfigs,
    msgId: string,
  ): Promise<boolean> {
    if (!tenantId) throw new Error('tenantId is required');
    if (configType === PageConfigs.CREATE_PAGE) return true;
    if (!pageEntity) return false;
    const { id, nvrId } = pageEntity.getProps();
    return this.serviceProvider.commandBus.execute(
      new UnlockPageRunningConfigCommand(
        tenantId,
        id,
        nvrId,
        configType,
        msgId,
      ),
    );
  }

  async stopAndRemoveAllRunningConfigs(
    pageEntity: PageEntity,
    tenantId: string,
  ) {
    const { id } = pageEntity.getProps();
    pageEntity = await this.serviceProvider.queryBus.execute(
      new FindPageByIdForTenantQuery(
        tenantId,
        [pageEntity.getProps().nvrId],
        id,
      ),
    );
    const { runningConfigs } = pageEntity.getProps();
    for (const msgId of Object.values(runningConfigs)) {
      if (msgId !== '-1') {
        await this.pageConfigQueueService.getAndDeleteRepeatableMsg(
          tenantId,
          pageEntity.getProps().nvrId,
          msgId,
        );
      }
    }
    await this.serviceProvider.commandBus.execute(
      new UpdatePageCommand({
        id,
        tenantId,
        nvrId: pageEntity.getProps().nvrId,
        runningConfigs: RunningConfigs.init().unpack(),
      }),
    );
  }

  private async isConfigRunning(
    pageEntity: PageEntity,
    tenantId: string,
    configType: PageConfigs,
  ) {
    const id = pageEntity.getProps().id;
    pageEntity = await this.serviceProvider.queryBus.execute(
      new FindPageByIdForTenantQuery(
        tenantId,
        [pageEntity.getProps().nvrId],
        id,
      ),
    );
    if (PageConfigs.CREATE_PAGE === configType) return false;
    const { runningConfigs } = pageEntity.getProps();
    if (runningConfigs[configType]) return true;
    return false;
  }

  private async runAndLockConfig(
    pageEntity: PageEntity,
    tenantId: string,
    configType: PageConfigs,
    msgId: string,
  ) {
    if (PageConfigs.CREATE_PAGE === configType) return;
    const id = pageEntity.getProps().id;
    pageEntity = await this.serviceProvider.queryBus.execute(
      new FindPageByIdForTenantQuery(
        tenantId,
        [pageEntity.getProps().nvrId],
        id,
      ),
    );
    const { runningConfigs } = pageEntity.getProps();
    await this.serviceProvider.commandBus.execute(
      new UpdatePageCommand({
        id,
        tenantId,
        nvrId: pageEntity.getProps().nvrId,
        runningConfigs: { ...runningConfigs, [configType]: msgId },
      }),
    );
  }
}
