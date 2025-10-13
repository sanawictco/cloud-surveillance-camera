import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { QueueService } from 'src/extensions/queue/queue.service';
import { QueueMsg } from 'src/extensions/queue/queue.interface';
import { MqttService } from 'src/extensions/mqtt/mqtt.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { PageConfigQueueMsgDto } from './pageConfigQueueMsg.dto';

import { ActorLogTypes } from 'src/modules/actorLogs/domain/actorLog.type';
import { PageRunningConfigService } from '../pageRunningConfig.service';
import {
  CreatePageProps,
  PageConfigs,
} from 'src/modules/dashboard/domain/page.type';
import { FindPageByIdQuery } from '../../queries/findPageById.queryHandler';
import { PageEntity } from 'src/modules/dashboard/domain/page.entity';
import { PageSystemLogService } from '../pageSystemLog.service';

@Injectable()
export class PageConfigQueueService {
  private queue: QueueService<PageConfigQueueMsgDto>;
  constructor(
    private readonly mqttService: MqttService,
    private readonly serviceProvider: ServiceProvider,
    @Inject(forwardRef(() => PageRunningConfigService))
    private readonly pageRunningConfigService: PageRunningConfigService,
    private readonly pageSystemLogService: PageSystemLogService,
  ) {
    this.queue = new QueueService<PageConfigQueueMsgDto>().createQueue(
      'pageConfigQueue',
      this.workerMsgHandler.bind(this).bind(this),
      this.expiredMsgHandler.bind(this).bind(this),
    );
  }

  async addRepeatableMsg(msgData: PageConfigQueueMsgDto): Promise<string> {
    const userInfo = this.serviceProvider.userInfoService.getProps();
    msgData.metadata.actorProps = userInfo
      ? {
          actorId: userInfo.id,
          actorType: ActorLogTypes.EMPLOYEE,
        }
      : undefined;
    await this.queue.addMsg(msgData, {
      repeat: {
        retryCount: msgData.metadata.retryCount,
        retryPeriodInSecond: msgData.metadata.retryPeriodInSecond,
      },
      msgId: msgData.msgId,
    });
    return msgData.msgId;
  }

  async getRepeatableMsg(msgId: string) {
    return await this.queue.getMsg(msgId);
  }

  async getAndDeleteRepeatableMsg(msgId: string) {
    return await this.queue.getAndDeleteMsg(msgId);
  }

  private async workerMsgHandler(queueMsg: QueueMsg) {
    const msg: PageConfigQueueMsgDto = queueMsg.data;
    if (msg.metadata.retryCount === queueMsg.opts.repeat?.count) return;
    await this.mqttService.publish(msg.metadata.topic, msg.msgId);
    console.log(
      'send pageConfig on mqtt=> ',
      msg,
      'currentRetryCount =>',
      queueMsg.opts.repeat?.count,
      'sendTime: ',
      new Date(queueMsg.timestamp).toLocaleString(),
    );
  }
  private async expiredMsgHandler(queueMsg: QueueMsg) {
    const msg: PageConfigQueueMsgDto = queueMsg.data;
    console.log('expired pageConfig msg ===============', msg.msgId);
    const { entityId } = msg.metadata;
    let pageEntity: PageEntity = await this.serviceProvider.queryBus.execute(
      new FindPageByIdQuery(entityId),
    );
    if (msg.configType === PageConfigs.CREATE_PAGE) {
      pageEntity = PageEntity.create(msg.data as CreatePageProps);
    }
    await this.pageRunningConfigService.doneAndUnLockConfig(
      pageEntity,
      msg.configType as PageConfigs,
    );
    await this.pageSystemLogService.handle(pageEntity, {
      configType: msg.configType,
      msgId: msg.msgId,
    });
  }
}
