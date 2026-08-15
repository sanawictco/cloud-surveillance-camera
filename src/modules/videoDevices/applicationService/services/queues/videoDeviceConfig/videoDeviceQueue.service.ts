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
import { VideoDeviceEntityTypes } from 'src/modules/videoDevices/shared/valueObjects/videoDeviceEntityTypes';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindCameraByIdQuery } from '../../../queries/camera/findCameraById.queryHandler';
import { FindNvrByIdQuery } from '../../../queries/nvr/findNvrById.queryHandler';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';

@Injectable()
export class VideoDeviceConfigQueueService implements OnModuleInit {
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
    if (entityType === VideoDeviceEntityTypes.NVR) {
      const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
        new FindNvrByIdQuery(entityId),
      );
      if (!nvrEntity) return; // just because of deleteNvr config
      await this.nvrRunningConfigService.doneAndUnLockConfig(
        nvrEntity,
        msg.configType,
      );
      await this.nvrSystemLogService.handle(nvrEntity, {
        configType: msg.configType,
        msgId: msg.msgId,
      });
    } else {
      const cameraEntity: CameraEntity =
        await this.serviceProvider.queryBus.execute(
          new FindCameraByIdQuery(entityId),
        );
      await this.CameraRunningConfigAndCommandService.doneAndUnLockConfig(
        cameraEntity,
        msg.configType,
      );
      await this.cameraSystemLogService.handle(cameraEntity, {
        configType: msg.configType,
        msgId: msg.msgId,
      });
    }
  }
}
