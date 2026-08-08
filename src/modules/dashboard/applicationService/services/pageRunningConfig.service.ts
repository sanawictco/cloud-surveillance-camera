import { BadRequestException, Injectable } from '@nestjs/common';

import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { PageEntity } from '../../domain/page.entity';
import { PageConfigs, UpdatePageProps } from '../../domain/page.type';
import { UpdatePageCommand } from '../commands/updatePage.command';
import { FindPageByIdQuery } from '../queries/findPageById.queryHandler';
import { PageConfigQueueService } from './queues/pageConfigQueue.service';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';

@Injectable()
export class PageRunningConfigService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly pageConfigQueueService: PageConfigQueueService,
  ) {}

  async runConfigIfNotDuplicated(
    pageEntity: PageEntity,
    configType: PageConfigs,
    data?: UpdatePageProps,
  ): Promise<string> {
    if (await this.isConfigRunning(pageEntity, configType)) {
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
        pageEntity.getConfigForFog(configType, data),
      );
      await this.runAndLockConfig(pageEntity, configType, msgId);
      return msgId;
    }
  }

  async doneAndUnLockConfig(pageEntity: PageEntity, configType: PageConfigs) {
    if (!pageEntity || configType === PageConfigs.DELETE_PAGE) return;
    const id = pageEntity.getProps().id;
    pageEntity = await this.serviceProvider.queryBus.execute(
      new FindPageByIdQuery(id),
    );
    if (!pageEntity) return;
    const { runningConfigs } = pageEntity.getProps();
    delete runningConfigs[configType];
    await this.serviceProvider.commandBus.execute(
      new UpdatePageCommand({
        id,
        runningConfigs,
      }),
    );
  }

  async stopAndRemoveAllRunningConfigs(pageEntity: PageEntity) {
    const { id } = pageEntity.getProps();
    pageEntity = await this.serviceProvider.queryBus.execute(
      new FindPageByIdQuery(id),
    );
    const { runningConfigs } = pageEntity.getProps();
    for (const msgId of Object.values(runningConfigs)) {
      if (msgId) {
        await this.pageConfigQueueService.getAndDeleteRepeatableMsg(msgId);
      }
    }
    await this.serviceProvider.commandBus.execute(
      new UpdatePageCommand({
        id,
        runningConfigs: RunningConfigs.init().unpack(),
      }),
    );
  }

  private async isConfigRunning(
    pageEntity: PageEntity,
    configType: PageConfigs,
  ) {
    const id = pageEntity.getProps().id;
    pageEntity = await this.serviceProvider.queryBus.execute(
      new FindPageByIdQuery(id),
    );
    if (PageConfigs.CREATE_PAGE === configType) return false;
    const { runningConfigs } = pageEntity.getProps();
    if (runningConfigs[configType]) return true;
    return false;
  }

  private async runAndLockConfig(
    pageEntity: PageEntity,
    configType: PageConfigs,
    msgId: string,
  ) {
    if (PageConfigs.CREATE_PAGE === configType) return;
    const id = pageEntity.getProps().id;
    pageEntity = await this.serviceProvider.queryBus.execute(
      new FindPageByIdQuery(id),
    );
    const { runningConfigs } = pageEntity.getProps();
    await this.serviceProvider.commandBus.execute(
      new UpdatePageCommand({
        id,
        runningConfigs: { ...runningConfigs, [configType]: msgId },
      }),
    );
  }
}
