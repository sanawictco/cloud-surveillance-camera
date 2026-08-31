import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { MqttEventDataDto } from 'src/extensions/mqtt/dtos/mqttEventData.dto';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { GLOBAL_ERROR_EVENT } from 'src/utilities/exception.filter';
import { PageEntity } from '../domain/page.entity';
import { FindPageByIdForTenantQuery } from '../applicationService/queries/findPageById.queryHandler';
import { PageConfigs } from '../domain/page.type';
import { PagesMqttService } from '../applicationService/services/page.mqtt.service';
import { PageRunningConfigService } from '../applicationService/services/pageRunningConfig.service';
import { PageConfigQueueService } from '../applicationService/services/queues/pageConfigQueue.service';
import { PageMqttRequestDto } from '../contracts/page.mqttRequest.dto';
import { NvrCloudSubOnFogMqttTopics } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import {
  pageConfigPubTopic,
  parsePageConfigResponseTopic,
  type ParsedDeviceResponseTopic,
} from 'src/modules/videoDevices/shared/deviceMqttTopics';
import { ActorPropsMsgIdDto } from 'src/modules/shared/dtos/actorPropsMsgId.dto';
import { validateMqttPayload } from 'src/extensions/mqtt/validateMqttPayload';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';
import { FindNvrByIdForTenantQuery } from 'src/modules/videoDevices/applicationService/queries/nvr/findNvrById.queryHandler';

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
      if (!msg) {
        // Idempotent consumption: a duplicate or late response whose pending
        // config was already consumed must not re-run side effects or surface
        // as an error.
        this.serviceProvider.logger.debug(
          `no pending page config for tenantId=${topic.tenantId} nvrId=${topic.nvrId} msgId=${msgId}`,
        );
        return;
      }
      if (
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
          pageConfigPubTopic(topic.tenantId, topic.nvrId) ||
        !Object.values(PageConfigs).includes(msg.configType as PageConfigs)
      ) {
        throw new Error('page configuration is unavailable');
      }
      const actorProps = msg?.metadata?.actorProps;
      const metadata: ActorPropsMsgIdDto = { actorProps, msgId };
      if (!actorProps) return;
      const data: any = msg.data;
      if (
        data.id !== msg.metadata.entityId ||
        (data.nvrId !== undefined && data.nvrId !== topic.nvrId)
      ) {
        throw new Error('page configuration payload identity mismatch');
      }

      const pageEntity: PageEntity | undefined =
        await this.serviceProvider.queryBus.execute(
          new FindPageByIdForTenantQuery(
            topic.tenantId,
            [topic.nvrId],
            data.id,
          ),
        );
      const nvrEntity = await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(topic.tenantId, topic.nvrId),
      );
      if (!nvrEntity) {
        throw new Error('page configuration entity ownership mismatch');
      }
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
          await this.pagesMqttService.create(
            topic.tenantId,
            topic.nvrId,
            data,
            metadata,
          );
          break;
        case PageConfigs.UPDATE_PAGE:
          await this.pagesMqttService.update(
            topic.tenantId,
            topic.nvrId,
            data,
            metadata,
          );
          break;
        case PageConfigs.DELETE_PAGE:
          await this.pagesMqttService.delete(
            topic.tenantId,
            topic.nvrId,
            pageEntity!,
            data,
            metadata,
          );
          break;
        default:
          break;
      }
      const consumed = await this.queue.getAndDeleteRepeatableMsg(
        topic.tenantId,
        topic.nvrId,
        msgId,
      );
      if (!consumed) throw new Error('failed to consume processed page config');
      if (msg.configType !== PageConfigs.DELETE_PAGE) {
        const unlocked =
          await this.pageRunningConfigService.doneAndUnLockConfig(
            pageEntity!,
            topic.tenantId,
            msg.configType as PageConfigs,
            msgId,
          );
        if (!unlocked) {
          throw new Error('page configuration ownership changed');
        }
      }
    } catch (err) {
      this.serviceProvider.eventEmitter.emit(GLOBAL_ERROR_EVENT, err);
    }
  }

  /**
   * Parses the response topic with the shared parser, which validates the
   * complete shape and UUID identity.
   */
  private parseTopic(topic: string): ParsedDeviceResponseTopic {
    return parsePageConfigResponseTopic(topic);
  }
}
