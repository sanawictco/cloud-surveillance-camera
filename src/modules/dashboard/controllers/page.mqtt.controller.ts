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
      const msg = await this.queue.getAndDeleteRepeatableMsg(msgId);
      const actorProps = msg?.metadata?.actorProps;
      const metadata: ActorPropsMsgIdDto = { actorProps, msgId };
      if (!actorProps) return;
      if (msg) {
        const data: any = msg.data;

        const pageEntity: PageEntity =
          await this.serviceProvider.queryBus.execute(
            new FindPageByIdQuery(data.id),
          );

        switch (msg.configType) {
          case PageConfigs.CREATE_PAGE:
            await this.pagesMqttService.create(data, metadata);
            break;
          case PageConfigs.UPDATE_PAGE:
            await this.pagesMqttService.update(data, metadata);
            break;
          case PageConfigs.DELETE_PAGE:
            await this.pagesMqttService.delete(pageEntity, data, metadata);
            break;
          default:
            break;
        }
        await this.pageRunningConfigService.doneAndUnLockConfig(
          pageEntity,
          msg.configType as PageConfigs,
        );
      }
    } catch (err) {
      this.serviceProvider.eventEmitter.emit(GLOBAL_ERROR_EVENT, err);
    }
  }
}
