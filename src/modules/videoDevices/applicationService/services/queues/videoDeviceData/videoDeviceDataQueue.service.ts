import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { MqttService } from 'src/extensions/mqtt/mqtt.service';
import { QueueMsg } from 'src/extensions/queue/queue.interface';
import { QueueService } from 'src/extensions/queue/queue.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { VideoDeviceDataQueueMsgDto } from './videoDeviceDataQueueMsg.dto';
import { NvrRunningConfigService } from '../../runningConfigs/nvrRunningConfig.service';
import { CameraRunningConfigAndCommandService } from '../../runningConfigs/cameraRunningConfigAndCommand.service';
import { NvrSystemLogService } from '../../systemLogs/nvrSystemLog.service';
import { CameraSystemLogService } from '../../systemLogs/cameraSystemLog.service';
import { ActorLogTypes } from 'src/modules/shared/dtos/actor.dto';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { FindNvrByIdQuery } from '../../../queries/nvr/findNvrById.queryHandler';
import { FindCameraByIdQuery } from '../../../queries/camera/findCameraById.queryHandler';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { buildDeviceJobId } from 'src/dddLib/utils/deviceMessageId';
import { generateRandomMsgId } from 'src/dddLib/utils/randomIdGenerator';

const MAX_MSG_ID_GENERATION_ATTEMPTS = 5;

@Injectable()
export class VideoDeviceDataQueueService implements OnModuleInit {
  private readonly activeAllocations = new Set<string>();

  constructor(
    private readonly mqttService: MqttService,
    private readonly serviceProvider: ServiceProvider,
    private readonly queue: QueueService<VideoDeviceDataQueueMsgDto>,
    @Inject(forwardRef(() => NvrRunningConfigService))
    private readonly nvrRunningConfigService: NvrRunningConfigService,
    @Inject(forwardRef(() => CameraRunningConfigAndCommandService))
    private readonly cameraConfigAndCommandService: CameraRunningConfigAndCommandService,
    private readonly nvrSystemLogService: NvrSystemLogService,
    private readonly cameraSystemLogService: CameraSystemLogService,
  ) {}

  onModuleInit(): void {
    this.queue.createQueue(
      'videoDeviceDataQueue',
      this.workerMsgHandler.bind(this),
      this.expiredMsgHandler.bind(this),
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

  private async workerMsgHandler(queueMsg: QueueMsg) {
    const msg: VideoDeviceDataQueueMsgDto = queueMsg.data;
    if (msg.metadata.retryCount === queueMsg.opts.repeat?.count) return;
    await this.mqttService.publish(msg.metadata.topic, msg.data);
    this.serviceProvider.logger.debug(
      `publish deviceData msgId=${msg.msgId} retry=${queueMsg.opts.repeat?.count}`,
    );
  }

  private async expiredMsgHandler(queueMsg: QueueMsg) {
    const msg: VideoDeviceDataQueueMsgDto = queueMsg.data;
    this.serviceProvider.logger.debug(
      'expired videoDeviceData msgId=',
      msg.msgId,
    );
    const { entityType, entityId } = msg.metadata;
    if (entityType === EntityTypes.NVR) {
      const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
        new FindNvrByIdQuery(entityId),
      );
      if (!nvrEntity) return; // only for deleteNvr config
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
        await this.cameraConfigAndCommandService.doneAndUnLockConfig(
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
