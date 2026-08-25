import { Injectable } from '@nestjs/common';
import { PageConfigQueueService } from '../services/queues/pageConfigQueue.service';
import { PageConfigs } from '../../domain/page.type';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { FindPageByIdQuery } from '../queries/findPageById.queryHandler';
import { PageEntity } from '../../domain/page.entity';
import { FindAllPagesQuery } from '../queries/findAllPages.queryHandler';
import { PageRunningConfigService } from '../services/pageRunningConfig.service';

@Injectable()
export class DashboardApiForFogCommunicationManagerService {
  constructor(
    private readonly pageConfigQueueService: PageConfigQueueService,
    private readonly serviceProvider: ServiceProvider,
    private readonly pageRunningConfigService: PageRunningConfigService,
  ) {}

  async stopRunningConfigsForNvr(
    tenantId: string,
    nvrId: string,
  ): Promise<void> {
    const pages: PageEntity[] = await this.serviceProvider.queryBus.execute(
      new FindAllPagesQuery({ filter: { nvrId } }),
    );
    for (const page of pages) {
      await this.pageRunningConfigService.stopAndRemoveAllRunningConfigs(
        page,
        tenantId,
      );
    }
  }

  async getOwnedPageConfig(tenantId: string, nvrId: string, msgId: string) {
    const queued = await this.pageConfigQueueService.getRepeatableMsg(
      tenantId,
      nvrId,
      msgId,
    );
    const now = Date.now();
    if (
      !queued ||
      queued.msgId !== msgId ||
      queued.tenantId !== tenantId ||
      queued.nvrId !== nvrId ||
      queued.metadata.entityType !== EntityTypes.PAGE ||
      !Object.values(PageConfigs).includes(queued.configType as PageConfigs) ||
      typeof queued.metadata.issuedAt !== 'number' ||
      typeof queued.metadata.expiresAt !== 'number' ||
      queued.metadata.issuedAt > now ||
      queued.metadata.expiresAt <= queued.metadata.issuedAt ||
      queued.metadata.expiresAt < now ||
      queued.metadata.topic !== `${tenantId}/${nvrId}/page/config/pub`
    ) {
      throw new Error('configuration is unavailable');
    }

    const data = queued.data as { id?: unknown; nvrId?: unknown };
    if (data.nvrId !== undefined && data.nvrId !== nvrId) {
      throw new Error('configuration is unavailable');
    }
    if (data.id !== undefined && data.id !== queued.metadata.entityId) {
      throw new Error('configuration is unavailable');
    }
    if (queued.configType !== PageConfigs.CREATE_PAGE) {
      const page: PageEntity | undefined =
        await this.serviceProvider.queryBus.execute(
          new FindPageByIdQuery(queued.metadata.entityId),
        );
      if (!page || page.getProps().nvrId !== nvrId) {
        throw new Error('configuration is unavailable');
      }
    }
    return queued;
  }
}
