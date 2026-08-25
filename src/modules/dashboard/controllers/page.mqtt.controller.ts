import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { MqttEventDataDto } from 'src/extensions/mqtt/dtos/mqttEventData.dto';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { GLOBAL_ERROR_EVENT } from 'src/utilities/exception.filter';
import { PageEntity } from '../domain/page.entity';
import { FindPageByIdQuery } from '../applicationService/queries/findPageById.queryHandler';
import { PageConfigs } from '../domain/page.type';
import { PagesMqttService } from '../applicationService/services/page.mqtt.service';
import { PageRunningConfigService } from '../applicationService/services/pageRunningConfig.service';
import { PageConfigQueueService } from '../applicationService/services/queues/pageConfigQueue.service';
import { PageMqttRequestDto } from '../contracts/page.mqttRequest.dto';
import { NvrCloudSubOnFogMqttTopics } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { ActorPropsMsgIdDto } from 'src/modules/shared/dtos/actorPropsMsgId.dto';
import { validateMqttPayload } from 'src/extensions/mqtt/validateMqttPayload';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';

@Injectable()
export class PageMqttController {
  constructor(
    private readonly queue: PageConfigQueueService,
    private readonly serviceProvider: ServiceProvider,
    private readonly pageRunningConfigService: PageRunningConfigService,
    private readonly pagesMqttService: PagesMqttService,
  ) {}

  @OnEvent(NvrCloudSubOnFogMqttTopics.pageConfigs)
  async handler(mqttEventData: MqttEventDataDto) {
    try {
      const { message } = mqttEventData;
      const parsedMessage = validateMqttPayload(
        PageMqttRequestDto,
        JSON.parse(message),
      );
      const { msgId } = parsedMessage;
      const topic = this.parseTopic(mqttEventData.topic);
      const msg = await this.queue.getRepeatableMsg(
        topic.tenantId,
        topic.nvrId,
        msgId,
      );
      if (
        !msg ||
        msg.msgId !== msgId ||
        msg.tenantId !== topic.tenantId ||
        msg.nvrId !== topic.nvrId ||
        msg.metadata.entityType !== EntityTypes.PAGE ||
        typeof msg.metadata.issuedAt !== 'number' ||
        typeof msg.metadata.expiresAt !== 'number' ||
        msg.metadata.issuedAt > Date.now() ||
        msg.metadata.expiresAt <= msg.metadata.issuedAt ||
        msg.metadata.expiresAt < Date.now() ||
        msg.metadata.topic !==
          `${topic.tenantId}/${topic.nvrId}/page/config/pub` ||
        !Object.values(PageConfigs).includes(msg.configType as PageConfigs)
      ) {
        throw new Error('page configuration is unavailable');
      }
      const actorProps = msg?.metadata?.actorProps;
      const metadata: ActorPropsMsgIdDto = { actorProps, msgId };
      if (!actorProps) return;
      if (msg) {
        const data: any = msg.data;
        if (
          data.id !== msg.metadata.entityId ||
          (data.nvrId !== undefined && data.nvrId !== topic.nvrId)
        ) {
          throw new Error('page configuration payload identity mismatch');
        }

        const pageEntity: PageEntity | undefined =
          await this.serviceProvider.queryBus.execute(
            new FindPageByIdQuery(data.id),
          );
        if (
          msg.configType !== PageConfigs.CREATE_PAGE &&
          (!pageEntity ||
            pageEntity.id !== msg.metadata.entityId ||
            pageEntity.getProps().nvrId !== topic.nvrId)
        ) {
          throw new Error('page configuration entity ownership mismatch');
        }

        switch (msg.configType) {
          case PageConfigs.CREATE_PAGE:
            await this.pagesMqttService.create(data, metadata);
            break;
          case PageConfigs.UPDATE_PAGE:
            await this.pagesMqttService.update(data, metadata);
            break;
          case PageConfigs.DELETE_PAGE:
            await this.pagesMqttService.delete(pageEntity!, data, metadata);
            break;
          default:
            break;
        }
        const consumed = await this.queue.getAndDeleteRepeatableMsg(
          topic.tenantId,
          topic.nvrId,
          msgId,
        );
        if (!consumed)
          throw new Error('failed to consume processed page config');
        await this.pageRunningConfigService.doneAndUnLockConfig(
          pageEntity!,
          msg.configType as PageConfigs,
        );
      }
    } catch (err) {
      this.serviceProvider.eventEmitter.emit(GLOBAL_ERROR_EVENT, err);
    }
  }

  private parseTopic(topic: string): { tenantId: string; nvrId: string } {
    const segments = topic.split('/');
    if (
      segments.length !== 5 ||
      segments[2] !== 'page' ||
      segments[3] !== 'config' ||
      segments[4] !== 'sub' ||
      !segments[0] ||
      !segments[1]
    ) {
      throw new Error('invalid page config topic');
    }
    return { tenantId: segments[0], nvrId: segments[1] };
  }
}
