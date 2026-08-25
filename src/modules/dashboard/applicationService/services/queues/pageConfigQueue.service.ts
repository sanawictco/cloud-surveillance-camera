import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
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
import { buildDeviceJobId } from 'src/dddLib/utils/deviceMessageId';
import { generateRandomMsgId } from 'src/dddLib/utils/randomIdGenerator';

const MAX_MSG_ID_GENERATION_ATTEMPTS = 5;

@Injectable()
export class PageConfigQueueService implements OnModuleInit {
  private readonly activeAllocations = new Set<string>();

  constructor(
    private readonly mqttService: MqttService,
    private readonly serviceProvider: ServiceProvider,
    private readonly queue: QueueService<PageConfigQueueMsgDto>,
    @Inject(forwardRef(() => PageRunningConfigService))
    private readonly pageRunningConfigService: PageRunningConfigService,
    private readonly pageSystemLogService: PageSystemLogService,
  ) {}

  onModuleInit(): void {
    this.queue.createQueue(
      'pageConfigQueue',
      this.workerMsgHandler.bind(this),
      this.expiredMsgHandler.bind(this),
    );
  }

  async addRepeatableMsg(msgData: PageConfigQueueMsgDto): Promise<string> {
    const issuedAt = Date.now();
    msgData.metadata.issuedAt = issuedAt;
    msgData.metadata.expiresAt =
      issuedAt +
      (msgData.metadata.retryCount + 1) *
        msgData.metadata.retryPeriodInSecond *
        1000;
    const userInfo = this.serviceProvider.userInfoService.getProps();
    msgData.metadata.actorProps = userInfo
      ? {
          actorId: userInfo.id,
          actorType: ActorLogTypes.EMPLOYEE,
        }
      : undefined;
    for (let attempt = 0; attempt < MAX_MSG_ID_GENERATION_ATTEMPTS; attempt++) {
      const jobId = this.buildJobId(
        msgData.tenantId,
        msgData.nvrId,
        msgData.msgId,
      );
      if (
        this.activeAllocations.has(jobId) ||
        (await this.queue.getMsg(jobId))
      ) {
        msgData.msgId = generateRandomMsgId();
        continue;
      }
      this.activeAllocations.add(jobId);
      try {
        await this.queue.addMsg(msgData, {
          repeat: {
            retryCount: msgData.metadata.retryCount,
            retryPeriodInSecond: msgData.metadata.retryPeriodInSecond,
          },
          msgId: jobId,
        });
        return msgData.msgId;
      } finally {
        this.activeAllocations.delete(jobId);
      }
    }
    throw new Error('could not allocate an active scoped device message ID');
  }

  async getRepeatableMsg(tenantId: string, nvrId: string, msgId: string) {
    return await this.queue.getMsg(this.buildJobId(tenantId, nvrId, msgId));
  }

  async getAndDeleteRepeatableMsg(
    tenantId: string,
    nvrId: string,
    msgId: string,
  ) {
    return await this.queue.getAndDeleteMsg(
      this.buildJobId(tenantId, nvrId, msgId),
    );
  }

  private buildJobId(tenantId: string, nvrId: string, msgId: string): string {
    return buildDeviceJobId(tenantId, nvrId, msgId);
  }

  private async workerMsgHandler(queueMsg: QueueMsg) {
    const msg: PageConfigQueueMsgDto = queueMsg.data;
    if (msg.metadata.retryCount === queueMsg.opts.repeat?.count) return;
    await this.mqttService.publish(msg.metadata.topic, msg.msgId);
    this.serviceProvider.logger.debug(
      `publish pageConfig msgId=${msg.msgId} configType=${msg.configType} retry=${queueMsg.opts.repeat?.count}`,
    );
  }
  private async expiredMsgHandler(queueMsg: QueueMsg) {
    const msg: PageConfigQueueMsgDto = queueMsg.data;
    this.serviceProvider.logger.debug(
      `expired pageConfig msgId=${msg.msgId} configType=${msg.configType}`,
    );
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
