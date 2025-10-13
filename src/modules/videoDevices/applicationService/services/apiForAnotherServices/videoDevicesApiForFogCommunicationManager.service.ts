import { Injectable } from '@nestjs/common';
import { MqttService } from 'src/extensions/mqtt/mqtt.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { NvrValidator } from '../http/validators/nvr.validator';
import { NvrConfigQueueService } from '../queues/nvrConfig/nvrQueue.service';
import { CameraConfigQueueService } from '../queues/cameraConfig/cameraConfigQueue.service';
import { NvrSystemLogService } from '../systemLogs/nvrSystemLog.service';
import { NvrLiveSignalService } from '../liveSignals/nvrLiveSignal.service';
import { NvrRunningConfigService } from '../runningConfigs/nvrRunningConfig.service';
import { WebsocketService } from 'src/extensions/websocket/websocket.service';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { FindAllNvrsQuery } from '../../queries/nvr/findAllNvrs.queryHandler';
import { UpdateNvrCommand } from '../../commands/nvr/updateNvr.command';
import { CloudIsRecoveringWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/cloudIsRecovering.wsResponse.dto';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import {
  NvrConfigs,
  NvrWebSocketDataTypes,
} from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { RestoreNvrsToCacheCommand } from '../../commands/nvr/restoreNvrsToCache.command';
import { RestoreCamerasToCacheCommand } from '../../commands/camera/restoreCamerasToCache.command';
import { DashboardApiForVideoDevicesService } from 'src/modules/dashboard/applicationService/apiForAnotherServices/dashboardApiForDevices.service';

@Injectable()
export class VideoDevicesApiForFogCommunicationManagerService {
  constructor(
    private readonly nvrValidator: NvrValidator,
    private readonly nvrConfigQueueService: NvrConfigQueueService,
    private readonly cameraConfigQueueService: CameraConfigQueueService,
    private readonly serviceProvider: ServiceProvider,
    private readonly mqttService: MqttService,
    private readonly nvrSystemLogService: NvrSystemLogService,
    private readonly nvrLiveSignalService: NvrLiveSignalService,
    private readonly nvrRunningConfigAndCommandService: NvrRunningConfigService,
    private readonly websocketService: WebsocketService,
    private readonly dashboardApiForVideoDevicesService: DashboardApiForVideoDevicesService,
  ) {}
  async checkExistsNvrWithSerialNumber(
    serialNumber: string,
  ): Promise<NvrEntity> {
    return await this.nvrValidator.checkExistsNvrBySerialNumber(serialNumber);
  }

  async getVideoDeviceConfigFromQueue(msgId: string) {
    const msg =
      (await this.nvrConfigQueueService.getRepeatableMsg(msgId)) ||
      (await this.cameraConfigQueueService.getRepeatableMsg(msgId));
    return msg;
  }

  async sendCloudIsAvailableSignalToFog() {
    this.serviceProvider.scheduler.setInterval(async () => {
      const nvrEntities: NvrEntity[] =
        await this.serviceProvider.queryBus.execute(
          new FindAllNvrsQuery({ filter: { isActive: true } }),
        );
      for (const nvrEntity of nvrEntities) {
        await this.mqttService.publish(
          nvrEntity.getCloudPubToFogMqttTopics().cloudIsAvailable,
          '1',
        );
      }
    }, 10);
  }

  async preProcessCloudRecovery(nvrEntity: NvrEntity) {
    await this.serviceProvider.commandBus.execute(
      new UpdateNvrCommand({
        id: nvrEntity.id,
        cloudIsRecovering: true,
      }),
    );
    // send cloud is recovering signal to fog
    this.websocketService.sendMessage<CloudIsRecoveringWsResponseDto>(
      this.websocketService.channels.DEVICES_SOCKET,
      {
        type: WebSocketTypes.DATA,
        data: {
          id: nvrEntity.id,
          cloudIsRecovering: true,
        },
        metadata: {
          dataType: NvrWebSocketDataTypes.CLOUD_IS_RECOVERING,
        },
      },
    );
  }

  async postProcessCloudRecovery(nvrEntity: NvrEntity) {
    // restore all mongodb data to cache (update cache)
    // point: update cache operation must be done before any other operation, otherwise the cache data will not be valid
    await this.serviceProvider.commandBus.execute(
      new RestoreNvrsToCacheCommand(),
    );

    await this.serviceProvider.commandBus.execute(
      new RestoreCamerasToCacheCommand(),
    );
    await this.dashboardApiForVideoDevicesService.restoreToCache();

    await this.serviceProvider.commandBus.execute(
      new UpdateNvrCommand({
        id: nvrEntity.id,
        cloudIsRecovering: false,
      }),
    );
    // stop all running config of the nvr (mostly because of stop and remove the running liveSignal config)
    await this.nvrRunningConfigAndCommandService.stopAndRemoveAllRunningConfigs(
      nvrEntity,
    );
    // send cloud is recovered signal to fog
    this.websocketService.sendMessage<CloudIsRecoveringWsResponseDto>(
      this.websocketService.channels.DEVICES_SOCKET,
      {
        type: WebSocketTypes.DATA,
        data: {
          id: nvrEntity.id,
          cloudIsRecovering: false,
        },
        metadata: {
          dataType: NvrWebSocketDataTypes.CLOUD_IS_RECOVERING,
        },
      },
    );
    await this.nvrSystemLogService.handle(nvrEntity, {
      configType: NvrConfigs.CLOUD_IS_RECOVERING,
      msgId: '',
    });
    await this.nvrLiveSignalService.toConncted(nvrEntity);
    await this.mqttService.publish(
      nvrEntity.getCloudPubToFogMqttTopics().cloudRecoveryDataAck,
      'cloud recovery finished',
    );
  }
}
