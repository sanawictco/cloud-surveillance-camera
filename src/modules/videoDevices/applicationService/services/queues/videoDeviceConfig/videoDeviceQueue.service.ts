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
import { FindCameraByIdQuery } from '../../../queries/camera/findCameraById.queryHandler';
import { FindNvrByIdQuery } from '../../../queries/nvr/findNvrById.queryHandler';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { buildDeviceJobId } from 'src/dddLib/utils/deviceMessageId';
import { generateRandomMsgId } from 'src/dddLib/utils/randomIdGenerator';

const MAX_MSG_ID_GENERATION_ATTEMPTS = 5;

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

  private async workerMsgHandler(queueMsg: QueueMsg) {
    const msg: VideoDeviceConfigQueueMsgDto = queueMsg.data;
    if (msg.metadata.retryCount === queueMsg.opts.repeat?.count) return;
    await this.mqttService.publish(msg.metadata.topic, msg.msgId);
    this.serviceProvider.logger.debug(
      `publish deviceConfig msgId=${msg.msgId} configType=${msg.configType} retry=${queueMsg.opts.repeat?.count}`,
    );
  }
  private async expiredMsgHandler(queueMsg: QueueMsg) {
    const msg: VideoDeviceConfigQueueMsgDto = queueMsg.data;
    this.serviceProvider.logger.debug(
      'expired videoDeviceConfig msgId =',
      msg.msgId,
      msg.configType,
    );
    const { entityType, entityId } = msg.metadata;
    if (entityType === EntityTypes.NVR) {
      const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
        new FindNvrByIdQuery(entityId),
      );
      if (!nvrEntity) return; // just because of deleteNvr config
      const expired = await this.nvrRunningConfigService.doneAndUnlockConfig(
        nvrEntity,
        msg.configType,
        msg.msgId,
      );
      if (!expired) return;
      await this.nvrSystemLogService.handle(nvrEntity, {
        configType: msg.configType,
        msgId: msg.msgId,
      });
    } else {
      const cameraEntity: CameraEntity =
        await this.serviceProvider.queryBus.execute(
          new FindCameraByIdQuery(entityId),
        );
      const expired =
        await this.CameraRunningConfigAndCommandService.doneAndUnLockConfig(
          cameraEntity,
          msg.configType,
          msg.msgId,
        );
      if (!expired) return;
      await this.cameraSystemLogService.handle(cameraEntity, {
        configType: msg.configType,
        msgId: msg.msgId,
      });
    }
  }
}
