import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { MqttService } from 'src/extensions/mqtt/mqtt.service';
import { QueueMsg } from 'src/extensions/queue/queue.interface';
import { QueueService } from 'src/extensions/queue/queue.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { VideoDeviceDataQueueMsgDto } from './videoDeviceDataQueueMsg.dto';
import { CameraRunningConfigAndCommandService } from '../../runningConfigs/cameraRunningConfigAndCommand.service';
import { CameraSystemLogService } from '../../systemLogs/cameraSystemLog.service';
import { ActorLogTypes } from 'src/modules/shared/dtos/actor.dto';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { FindNvrByIdForTenantQuery } from '../../../queries/nvr/findNvrById.queryHandler';
import { FindCameraByIdForTenantQuery } from '../../../queries/camera/findCameraById.queryHandler';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { buildDeviceJobId } from 'src/dddLib/utils/deviceMessageId';
import { generateRandomMsgId } from 'src/dddLib/utils/randomIdGenerator';
import {
  assertTenantQueueMessage,
  describeTenantQueueFailure,
} from 'src/modules/shared/tenantQueueMessage';
import { cameraDataPubTopic } from 'src/modules/videoDevices/shared/deviceMqttTopics';

const MAX_MSG_ID_GENERATION_ATTEMPTS = 5;
/**
 * Explicit worker sizing; see the config queue for why the shared default of
 * 1000 is not appropriate for a queue whose jobs actuate physical hardware.
 */
const VIDEO_DEVICE_DATA_WORKER_CONCURRENCY = 50;

@Injectable()
export class VideoDeviceDataQueueService implements OnModuleInit {
  private readonly activeAllocations = new Set<string>();

  // Only camera hardware commands are ever produced onto this queue
  // (`CameraEntity.generateFogHardwareCommand`), and the worker now rejects any
  // other entity type outright, so the NVR running-config/system-log
  // collaborators this class used to hold are no longer reachable from here.
  constructor(
    private readonly mqttService: MqttService,
    private readonly serviceProvider: ServiceProvider,
    private readonly queue: QueueService<VideoDeviceDataQueueMsgDto>,
    @Inject(forwardRef(() => CameraRunningConfigAndCommandService))
    private readonly cameraConfigAndCommandService: CameraRunningConfigAndCommandService,
    private readonly cameraSystemLogService: CameraSystemLogService,
  ) {}

  onModuleInit(): void {
    this.queue.createQueue(
      'videoDeviceDataQueue',
      this.workerMsgHandler.bind(this),
      this.expiredMsgHandler.bind(this),
      this.failureMsgHandler.bind(this),
      { concurrency: VIDEO_DEVICE_DATA_WORKER_CONCURRENCY },
    );
  }

  async addRepeatableMsg(msgData: VideoDeviceDataQueueMsgDto): Promise<string> {
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
      : msgData.metadata.actorProps;
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
      const dataParts = msgData.data.split(',');
      dataParts[2] = msgData.msgId;
      msgData.data = dataParts.join(',');
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

  /**
   * The camera hardware topic has no tenant segment, so tenant binding for this
   * queue comes from the scoped job ID (validated below) plus the persisted
   * camera->NVR->tenant relationship checked at expiry.
   */
  private async workerMsgHandler(queueMsg: QueueMsg) {
    const msg: VideoDeviceDataQueueMsgDto = queueMsg.data;
    const scope = assertTenantQueueMessage(msg, {
      allowedEntityTypes: [EntityTypes.CAMERA],
      expectedTopic: ({ nvrId, entityId }) =>
        cameraDataPubTopic(nvrId, entityId),
      jobId: queueMsg.name,
    });
    if (msg.metadata.retryCount === queueMsg.opts.repeat?.count) return;
    await this.mqttService.publish(scope.topic, msg.data);
    this.serviceProvider.logger.debug(
      `publish deviceData tenantId=${scope.tenantId} nvrId=${scope.nvrId} msgId=${scope.msgId} retry=${queueMsg.opts.repeat?.count}`,
    );
  }

  private async expiredMsgHandler(queueMsg: QueueMsg) {
    const msg: VideoDeviceDataQueueMsgDto = queueMsg.data;
    const scope = assertTenantQueueMessage(msg, {
      allowedEntityTypes: [EntityTypes.CAMERA],
      expectedTopic: ({ nvrId, entityId }) =>
        cameraDataPubTopic(nvrId, entityId),
      jobId: queueMsg.name,
      allowExpired: true,
    });
    this.serviceProvider.logger.debug(
      `expired videoDeviceData tenantId=${scope.tenantId} nvrId=${scope.nvrId} msgId=${scope.msgId}`,
    );
    const nvrEntity: NvrEntity | undefined =
      await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(scope.tenantId, scope.nvrId),
      );
    if (!nvrEntity) return; // NVR removed while the command was in flight
    const cameraEntity: CameraEntity | undefined =
      await this.serviceProvider.queryBus.execute(
        new FindCameraByIdForTenantQuery(scope.tenantId, scope.entityId),
      );
    if (!cameraEntity) return;
    if (cameraEntity.getProps().nvrId !== scope.nvrId) {
      throw new Error('queued camera command identity mismatch');
    }
    const expired =
      await this.cameraConfigAndCommandService.doneAndUnLockConfig(
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

  private async failureMsgHandler(queueMsg: QueueMsg, err: Error) {
    this.serviceProvider.logger.error(
      `videoDeviceDataQueue job failed: ${describeTenantQueueFailure(
        queueMsg.data,
        queueMsg.attemptsMade,
      )} reason=${err.message}`,
    );
  }
}
