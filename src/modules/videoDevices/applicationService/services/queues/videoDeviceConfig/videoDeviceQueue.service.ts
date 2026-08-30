import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { QueueService } from 'src/extensions/queue/queue.service';
import { QueueMsg } from 'src/extensions/queue/queue.interface';
import { MqttService } from 'src/extensions/mqtt/mqtt.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { VideoDeviceConfigQueueMsgDto } from './videoDeviceConfigQueueMsg.dto';
import { NvrRunningConfigService } from '../../runningConfigs/nvrRunningConfig.service';
import { CameraRunningConfigAndCommandService } from '../../runningConfigs/cameraRunningConfigAndCommand.service';
import { NvrSystemLogService } from '../../systemLogs/nvrSystemLog.service';
import { CameraSystemLogService } from '../../systemLogs/cameraSystemLog.service';
import { ActorLogTypes } from 'src/modules/shared/dtos/actor.dto';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindCameraByIdForTenantQuery } from '../../../queries/camera/findCameraById.queryHandler';
import { FindNvrByIdForTenantQuery } from '../../../queries/nvr/findNvrById.queryHandler';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { buildDeviceJobId } from 'src/dddLib/utils/deviceMessageId';
import { generateRandomMsgId } from 'src/dddLib/utils/randomIdGenerator';
import {
  assertTenantQueueMessage,
  describeTenantQueueFailure,
} from 'src/modules/shared/tenantQueueMessage';
import { videoDeviceConfigPubTopic } from 'src/modules/videoDevices/shared/deviceMqttTopics';

const MAX_MSG_ID_GENERATION_ATTEMPTS = 5;
/**
 * Explicit worker sizing. The shared default of 1000 is rule-engine sizing and
 * is far above what this queue's downstream (MQTT broker + Mongo pool + a
 * physical NVR) can absorb; each job publishes to a device.
 */
const VIDEO_DEVICE_CONFIG_WORKER_CONCURRENCY = 50;

@Injectable()
export class VideoDeviceConfigQueueService implements OnModuleInit {
  private readonly activeAllocations = new Set<string>();

  constructor(
    private readonly mqttService: MqttService,
    private readonly serviceProvider: ServiceProvider,
    private readonly queue: QueueService<VideoDeviceConfigQueueMsgDto>,
    @Inject(forwardRef(() => NvrRunningConfigService))
    private readonly nvrRunningConfigService: NvrRunningConfigService,
    @Inject(forwardRef(() => CameraRunningConfigAndCommandService))
    private readonly CameraRunningConfigAndCommandService: CameraRunningConfigAndCommandService,
    private readonly nvrSystemLogService: NvrSystemLogService,
    private readonly cameraSystemLogService: CameraSystemLogService,
  ) {}

  onModuleInit(): void {
    this.queue.createQueue(
      'videoDeviceConfigQueue',
      this.workerMsgHandler.bind(this),
      this.expiredMsgHandler.bind(this),
      this.failureMsgHandler.bind(this),
      { concurrency: VIDEO_DEVICE_CONFIG_WORKER_CONCURRENCY },
    );
  }

  async addRepeatableMsg(
    msgData: VideoDeviceConfigQueueMsgDto,
  ): Promise<string> {
    await this.reserveMsgId(msgData);
    return this.addReservedRepeatableMsg(msgData);
  }

  async reserveMsgId(msgData: VideoDeviceConfigQueueMsgDto): Promise<string> {
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
      return msgData.msgId;
    }
    throw new Error('could not allocate an active scoped device message ID');
  }

  async addReservedRepeatableMsg(
    msgData: VideoDeviceConfigQueueMsgDto,
  ): Promise<string> {
    const jobId = this.buildJobId(
      msgData.tenantId,
      msgData.nvrId,
      msgData.msgId,
    );
    if (!this.activeAllocations.has(jobId)) {
      throw new Error('device message ID is not reserved');
    }
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

  releaseMsgIdReservation(
    tenantId: string,
    nvrId: string,
    msgId: string,
  ): void {
    this.activeAllocations.delete(this.buildJobId(tenantId, nvrId, msgId));
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

  /**
   * Validates the job's own tenant scope before publishing. The publish target
   * is the topic derived from the validated tenant/NVR, never the raw stored
   * `metadata.topic`, so a stale or forged job cannot reach another tenant's
   * device.
   */
  private async workerMsgHandler(queueMsg: QueueMsg) {
    const msg: VideoDeviceConfigQueueMsgDto = queueMsg.data;
    const scope = assertTenantQueueMessage(msg, {
      allowedEntityTypes: [EntityTypes.NVR, EntityTypes.CAMERA],
      expectedTopic: ({ tenantId, nvrId }) =>
        videoDeviceConfigPubTopic(tenantId, nvrId),
      jobId: queueMsg.name,
    });
    if (msg.metadata.retryCount === queueMsg.opts.repeat?.count) return;
    await this.mqttService.publish(scope.topic, scope.msgId);
    this.serviceProvider.logger.debug(
      `publish deviceConfig tenantId=${scope.tenantId} nvrId=${scope.nvrId} msgId=${scope.msgId} configType=${scope.configType} retry=${queueMsg.opts.repeat?.count}`,
    );
  }

  private async expiredMsgHandler(queueMsg: QueueMsg) {
    const msg: VideoDeviceConfigQueueMsgDto = queueMsg.data;
    // Expiry runs after the final retry, so the lifetime window is already
    // closed; only structure and tenant scope are re-validated here.
    const scope = assertTenantQueueMessage(msg, {
      allowedEntityTypes: [EntityTypes.NVR, EntityTypes.CAMERA],
      expectedTopic: ({ tenantId, nvrId }) =>
        videoDeviceConfigPubTopic(tenantId, nvrId),
      jobId: queueMsg.name,
      allowExpired: true,
    });
    this.serviceProvider.logger.debug(
      `expired videoDeviceConfig tenantId=${scope.tenantId} nvrId=${scope.nvrId} msgId=${scope.msgId} configType=${scope.configType}`,
    );
    if (scope.entityType === EntityTypes.NVR) {
      if (scope.entityId !== scope.nvrId) {
        throw new Error('queued NVR config identity mismatch');
      }
      const nvrEntity: NvrEntity | undefined =
        await this.serviceProvider.queryBus.execute(
          new FindNvrByIdForTenantQuery(scope.tenantId, scope.nvrId),
        );
      if (!nvrEntity) return; // just because of deleteNvr config
      const expired = await this.nvrRunningConfigService.doneAndUnlockConfig(
        nvrEntity,
        scope.configType,
        scope.msgId,
      );
      if (!expired) return;
      await this.nvrSystemLogService.handle(nvrEntity, {
        configType: scope.configType,
        msgId: scope.msgId,
      });
    } else {
      const cameraEntity: CameraEntity | undefined =
        await this.serviceProvider.queryBus.execute(
          new FindCameraByIdForTenantQuery(scope.tenantId, scope.entityId),
        );
      if (!cameraEntity) return;
      if (cameraEntity.getProps().nvrId !== scope.nvrId) {
        throw new Error('queued camera config identity mismatch');
      }
      const expired =
        await this.CameraRunningConfigAndCommandService.doneAndUnLockConfig(
          cameraEntity,
          scope.configType,
          scope.msgId,
        );
      if (!expired) return;
      await this.cameraSystemLogService.handle(cameraEntity, {
        configType: scope.configType,
        msgId: scope.msgId,
      });
    }
  }

  /**
   * Failure diagnostics carry tenant identity but never the payload: device
   * configuration messages contain credentials and full device state.
   */
  private async failureMsgHandler(queueMsg: QueueMsg, err: Error) {
    this.serviceProvider.logger.error(
      `videoDeviceConfigQueue job failed: ${describeTenantQueueFailure(
        queueMsg.data,
        queueMsg.attemptsMade,
      )} reason=${err.message}`,
    );
  }
}
