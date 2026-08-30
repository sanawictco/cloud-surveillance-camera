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
import { FindPageByIdForTenantQuery } from '../../queries/findPageById.queryHandler';
import { PageEntity } from 'src/modules/dashboard/domain/page.entity';
import { PageSystemLogService } from '../pageSystemLog.service';
import { buildDeviceJobId } from 'src/dddLib/utils/deviceMessageId';
import { generateRandomMsgId } from 'src/dddLib/utils/randomIdGenerator';
import { FindNvrByIdForTenantQuery } from 'src/modules/videoDevices/applicationService/queries/nvr/findNvrById.queryHandler';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';
import {
  assertTenantQueueMessage,
  describeTenantQueueFailure,
} from 'src/modules/shared/tenantQueueMessage';
import { pageConfigPubTopic } from 'src/modules/videoDevices/shared/deviceMqttTopics';

const MAX_MSG_ID_GENERATION_ATTEMPTS = 5;
/**
 * Explicit worker sizing instead of the shared rule-engine default of 1000;
 * every job here publishes a page configuration to a physical NVR.
 */
const PAGE_CONFIG_WORKER_CONCURRENCY = 50;

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
      this.failureMsgHandler.bind(this),
      { concurrency: PAGE_CONFIG_WORKER_CONCURRENCY },
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
    const scope = assertTenantQueueMessage(msg, {
      allowedEntityTypes: [EntityTypes.PAGE],
      expectedTopic: ({ tenantId, nvrId }) =>
        pageConfigPubTopic(tenantId, nvrId),
      jobId: queueMsg.name,
    });
    if (msg.metadata.retryCount === queueMsg.opts.repeat?.count) return;
    await this.mqttService.publish(scope.topic, scope.msgId);
    this.serviceProvider.logger.debug(
      `publish pageConfig tenantId=${scope.tenantId} nvrId=${scope.nvrId} msgId=${scope.msgId} configType=${scope.configType} retry=${queueMsg.opts.repeat?.count}`,
    );
  }

  private async expiredMsgHandler(queueMsg: QueueMsg) {
    const msg: PageConfigQueueMsgDto = queueMsg.data;
    const scope = assertTenantQueueMessage(msg, {
      allowedEntityTypes: [EntityTypes.PAGE],
      expectedTopic: ({ tenantId, nvrId }) =>
        pageConfigPubTopic(tenantId, nvrId),
      jobId: queueMsg.name,
      allowExpired: true,
    });
    this.serviceProvider.logger.debug(
      `expired pageConfig tenantId=${scope.tenantId} nvrId=${scope.nvrId} msgId=${scope.msgId} configType=${scope.configType}`,
    );
    let pageEntity: PageEntity;
    if (scope.configType === PageConfigs.CREATE_PAGE) {
      pageEntity = PageEntity.create({
        ...(msg.data as CreatePageProps),
        tenantId: scope.tenantId,
        nvrId: scope.nvrId,
        originId: scope.entityId,
      });
    } else {
      pageEntity = await this.serviceProvider.queryBus.execute(
        new FindPageByIdForTenantQuery(
          scope.tenantId,
          [scope.nvrId],
          scope.entityId,
        ),
      );
    }
    if (!pageEntity || pageEntity.getProps().nvrId !== scope.nvrId) {
      throw new Error('page queue tenant scope is invalid');
    }
    const nvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdForTenantQuery(scope.tenantId, scope.nvrId),
    );
    if (!nvrEntity) throw new Error('page queue tenant scope is invalid');
    const expired = await this.pageRunningConfigService.doneAndUnLockConfig(
      pageEntity,
      scope.tenantId,
      scope.configType as PageConfigs,
      scope.msgId,
    );
    if (!expired) return;
    await this.pageSystemLogService.handle(scope.tenantId, pageEntity, {
      configType: scope.configType,
      msgId: scope.msgId,
    });
  }

  private async failureMsgHandler(queueMsg: QueueMsg, err: Error) {
    this.serviceProvider.logger.error(
      `pageConfigQueue job failed: ${describeTenantQueueFailure(
        queueMsg.data,
        queueMsg.attemptsMade,
      )} reason=${err.message}`,
    );
  }
}
