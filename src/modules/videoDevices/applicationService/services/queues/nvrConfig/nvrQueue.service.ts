import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { MqttService } from 'src/extensions/mqtt/mqtt.service';
import { QueueMsg } from 'src/extensions/queue/queue.interface';
import { QueueService } from 'src/extensions/queue/queue.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { ActorLogTypes } from 'src/modules/shared/dtos/actor.dto';
import { FindNvrByIdQuery } from '../../../queries/nvr/findNvrById.queryHandler';
import { NvrRunningConfigService } from '../../runningConfigs/nvrRunningConfig.service';
import { NvrSystemLogService } from '../../systemLogs/nvrSystemLog.service';
import { NvrConfigQueueMsgDto } from './nvrConfigQueueMsg.dto';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { CameraConfigQueueMsgDto } from '../cameraConfig/cameraConfigQueueMsg.dto';

@Injectable()
export class NvrConfigQueueService {
  private queue: QueueService<NvrConfigQueueMsgDto>;
  constructor(
    private readonly mqttService: MqttService,
    private readonly serviceProvider: ServiceProvider,
    @Inject(forwardRef(() => NvrRunningConfigService))
    private readonly nvrRunningConfigService: NvrRunningConfigService,
    private readonly nvrSystemLogService: NvrSystemLogService,
  ) {
    this.queue = new QueueService<NvrConfigQueueMsgDto>().createQueue(
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
      'send nvrConfig on mqtt=> ',
      msg,
      'currentRetryCount =>',
      queueMsg.opts.repeat?.count,
      'sendTime: ',
      new Date(queueMsg.timestamp).toLocaleString(),
    );
  }
  private async expiredMsgHandler(queueMsg: QueueMsg) {
    const msg: NvrConfigQueueMsgDto = queueMsg.data;
    console.log(
      'expired nvrConfig msg ===============',
      msg.msgId,
      msg.configType,
    );
    const { entityId } = msg.metadata;

    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(entityId),
    );
    await this.nvrRunningConfigService.doneAndUnLockConfig(
      nvrEntity,
      msg.configType,
    );
    await this.nvrSystemLogService.handle(nvrEntity, {
      configType: msg.configType,
      msgId: msg.msgId,
    });
  }
}
