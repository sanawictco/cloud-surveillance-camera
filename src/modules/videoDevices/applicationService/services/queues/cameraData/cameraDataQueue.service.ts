import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { MqttService } from 'src/extensions/mqtt/mqtt.service';
import { QueueMsg } from 'src/extensions/queue/queue.interface';
import { QueueService } from 'src/extensions/queue/queue.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { CameraDataQueueMsgDto } from './cameraDataQueueMsg.dto';
import { ActorLogTypes } from 'src/modules/shared/dtos/actor.dto';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindCameraByIdQuery } from 'src/modules/videoDevices/applicationService/queries/camera/findCameraById.queryHandler';
import { CameraRunningConfigAndCommandService } from '../../runningConfigs/cameraRunningConfigAndCommand.service';
import { CameraSystemLogService } from '../../systemLogs/cameraSystemLog.service';

@Injectable()
export class CameraDataQueueService {
  private queue: QueueService<CameraDataQueueMsgDto>;
  constructor(
    private readonly mqttService: MqttService,
    private readonly serviceProvider: ServiceProvider,
    @Inject(forwardRef(() => CameraRunningConfigAndCommandService))
    private readonly cameraRunningConfigAndCommandService: CameraRunningConfigAndCommandService,
    private readonly cameraSystemLogService: CameraSystemLogService,
  ) {
    this.queue = new QueueService<CameraDataQueueMsgDto>().createQueue(
      'deviceDataQueue',
      this.workerMsgHandler.bind(this).bind(this),
      this.expiredMsgHandler.bind(this).bind(this),
    );
  }

  async addRepeatableMsg(msgData: CameraDataQueueMsgDto): Promise<string> {
    const userInfo = this.serviceProvider.userInfoService.getProps();
    msgData.metadata.actorProps = userInfo
      ? {
          actorId: userInfo.id,
          actorType: ActorLogTypes.EMPLOYEE,
        }
      : msgData.metadata.actorProps;
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
    const msg: CameraDataQueueMsgDto = queueMsg.data;
    if (msg.metadata.retryCount === queueMsg.opts.repeat?.count) return;
    await this.mqttService.publish(msg.metadata.topic, msg.data);
    console.log(
      'send deviceData on mqtt=> ',
      msg,
      'currentRetryCount =>',
      queueMsg.opts.repeat?.count,
      'sendTime: ',
      new Date(queueMsg.timestamp).toLocaleString(),
    );
  }

  private async expiredMsgHandler(queueMsg: QueueMsg) {
    const msg: CameraDataQueueMsgDto = queueMsg.data;
    console.log('expired deviceData msg ===============', msg.msgId);
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
