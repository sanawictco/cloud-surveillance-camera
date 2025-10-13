import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { MqttService } from 'src/extensions/mqtt/mqtt.service';
import { QueueMsg } from 'src/extensions/queue/queue.interface';
import { QueueService } from 'src/extensions/queue/queue.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { FindCameraByIdQuery } from 'src/modules/videoDevices/applicationService/queries/camera/findCameraById.queryHandler';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { ActorLogTypes } from 'src/modules/shared/dtos/actor.dto';
import { CameraConfigQueueMsgDto } from './cameraConfigQueueMsg.dto';
import { CameraRunningConfigAndCommandService } from '../../runningConfigs/cameraRunningConfigAndCommand.service';
import { CameraSystemLogService } from '../../systemLogs/cameraSystemLog.service';

@Injectable()
export class CameraConfigQueueService {
  private queue: QueueService<CameraConfigQueueMsgDto>;
  constructor(
    private readonly mqttService: MqttService,
    private readonly serviceProvider: ServiceProvider,
    @Inject(forwardRef(() => CameraRunningConfigAndCommandService))
    private readonly cameraRunningConfigAndCommandService: CameraRunningConfigAndCommandService,
    private readonly cameraSystemLogService: CameraSystemLogService,
  ) {
    this.queue = new QueueService<CameraConfigQueueMsgDto>().createQueue(
      'cameraConfigQueue',
      this.workerMsgHandler.bind(this).bind(this),
      this.expiredMsgHandler.bind(this).bind(this),
    );
  }

  async addRepeatableMsg(msgData: CameraConfigQueueMsgDto): Promise<string> {
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
    const msg: CameraConfigQueueMsgDto = queueMsg.data;
    if (msg.metadata.retryCount === queueMsg.opts.repeat?.count) return;
    await this.mqttService.publish(msg.metadata.topic, msg.msgId);
    console.log(
      'send cameraConfig on mqtt=> ',
      msg,
      'currentRetryCount =>',
      queueMsg.opts.repeat?.count,
      'sendTime: ',
      new Date(queueMsg.timestamp).toLocaleString(),
    );
  }
  private async expiredMsgHandler(queueMsg: QueueMsg) {
    const msg: CameraConfigQueueMsgDto = queueMsg.data;
    console.log(
      'expired cameraConfig msg ===============',
      msg.msgId,
      msg.configType,
    );
    const { entityId } = msg.metadata;

    const cameraEntity: CameraEntity =
      await this.serviceProvider.queryBus.execute(
        new FindCameraByIdQuery(entityId),
      );
    await this.cameraRunningConfigAndCommandService.doneAndUnLockConfig(
      cameraEntity,
      msg.configType,
    );
    await this.cameraSystemLogService.handle(cameraEntity, {
      configType: msg.configType,
      msgId: msg.msgId,
    });
  }
}
