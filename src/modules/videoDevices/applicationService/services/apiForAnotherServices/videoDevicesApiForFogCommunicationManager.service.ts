import { Injectable } from '@nestjs/common';
import { MqttService } from 'src/extensions/mqtt/mqtt.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { NvrValidator } from '../validators/nvr.validator';
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
  NVR_FOG_FETCHABLE_CONFIGS,
  NvrConfigs,
  NvrWebSocketDataTypes,
} from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { VideoDeviceConfigQueueService } from '../queues/videoDeviceConfig/videoDeviceQueue.service';
import { timingSafeEqual } from 'node:crypto';
import { FogVideoDeviceConfigRequestDto } from 'src/modules/videoDevices/contracts/nvr/http/request/fogConfig.request.dto';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';
import { FindNvrBySerialNumberQuery } from '../../queries/nvr/findNvrBySerialNumber.queryHandler';
import { AggregateID } from 'src/dddLib/core';
import { DashboardApiForFogCommunicationManagerService } from 'src/modules/dashboard/applicationService/apiForAnotherServices/dashboardApiForFogCommunicationManager.service';
import { CameraSoftwareConfigs } from 'src/modules/videoDevices/domain/camera/camera.type';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindCameraByIdQuery } from '../../queries/camera/findCameraById.queryHandler';
import { FindAllCamerasQuery } from '../../queries/camera/findAllCameras.queryHandler';
import { FindNvrByIdQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { CameraRunningConfigAndCommandService } from '../runningConfigs/cameraRunningConfigAndCommand.service';

export interface FogNvrProjection {
  id: AggregateID;
  tenantId: AggregateID;
  serialNumber: string;
  accessToken: string;
  cloudIsRecovering: boolean;
}

@Injectable()
export class VideoDevicesApiForFogCommunicationManagerService {
  constructor(
    private readonly nvrValidator: NvrValidator,
    private readonly videoDeviceConfigQueueService: VideoDeviceConfigQueueService,
    private readonly serviceProvider: ServiceProvider,
    private readonly mqttService: MqttService,
    private readonly nvrSystemLogService: NvrSystemLogService,
    private readonly nvrLiveSignalService: NvrLiveSignalService,
    private readonly nvrRunningConfigAndCommandService: NvrRunningConfigService,
    private readonly cameraRunningConfigAndCommandService: CameraRunningConfigAndCommandService,
    private readonly websocketService: WebsocketService,
    private readonly dashboardApiForFogCommunicationManagerService: DashboardApiForFogCommunicationManagerService,
  ) {}
  async checkExistsNvrWithSerialNumber(
    serialNumber: string,
  ): Promise<NvrEntity> {
    return await this.nvrValidator.checkExistsNvrBySerialNumber(serialNumber);
  }

  async getOwnedFogConfig(body: FogVideoDeviceConfigRequestDto) {
    const nvr = await this.checkExistsNvrWithSerialNumber(body.serialNumber);
    const expectedToken = Buffer.from(nvr.getProps().accessToken);
    const suppliedToken = Buffer.from(body.accessToken);
    if (
      expectedToken.length !== suppliedToken.length ||
      !timingSafeEqual(expectedToken, suppliedToken)
    ) {
      throw new Error('configuration is unavailable');
    }

    const nvrProps = nvr.getProps();
    if (body.configType === 'page') {
      const queued =
        await this.dashboardApiForFogCommunicationManagerService.getOwnedPageConfig(
          nvrProps.tenantId,
          nvr.id,
          body.msgId,
        );
      return { configType: queued.configType, data: queued.data };
    }

    const queued = await this.videoDeviceConfigQueueService.getRepeatableMsg(
      nvrProps.tenantId,
      nvr.id,
      body.msgId,
    );
    const now = Date.now();
    if (
      !queued ||
      queued.msgId !== body.msgId ||
      queued.nvrId !== nvr.id ||
      queued.tenantId !== nvrProps.tenantId ||
      typeof queued.metadata.issuedAt !== 'number' ||
      typeof queued.metadata.expiresAt !== 'number' ||
      queued.metadata.issuedAt > now ||
      queued.metadata.expiresAt <= queued.metadata.issuedAt ||
      queued.metadata.expiresAt < now ||
      queued.metadata.topic !==
        nvr.getCloudPubToFogMqttTopics().videoDeviceConfigs
    ) {
      throw new Error('configuration is unavailable');
    }

    const queuedData = queued.data as { id?: unknown; cameraId?: unknown };
    const payloadEntityId = queuedData.id ?? queuedData.cameraId;
    if (
      payloadEntityId !== undefined &&
      payloadEntityId !== queued.metadata.entityId
    ) {
      throw new Error('configuration is unavailable');
    }

    if (queued.metadata.entityType === EntityTypes.NVR) {
      if (
        queued.metadata.entityId !== nvr.id ||
        !NVR_FOG_FETCHABLE_CONFIGS.includes(
          queued.configType as (typeof NVR_FOG_FETCHABLE_CONFIGS)[number],
        )
      ) {
        throw new Error('configuration is unavailable');
      }
    } else if (queued.metadata.entityType === EntityTypes.CAMERA) {
      const camera: CameraEntity | undefined =
        await this.serviceProvider.queryBus.execute(
          new FindCameraByIdQuery(queued.metadata.entityId),
        );
      if (
        !camera ||
        camera.getProps().tenantId !== nvrProps.tenantId ||
        camera.getProps().nvrId !== nvr.id ||
        !Object.values(CameraSoftwareConfigs).includes(
          queued.configType as CameraSoftwareConfigs,
        )
      ) {
        throw new Error('configuration is unavailable');
      }
    } else {
      throw new Error('configuration is unavailable');
    }

    return { configType: queued.configType, data: queued.data };
  }

  async sendCloudIsAvailableSignalToFog() {
    await this.serviceProvider.scheduler.setInterval(async () => {
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
    }, 10_000);
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
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
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
    await this.serviceProvider.commandBus.execute(
      new UpdateNvrCommand({
        id: nvrEntity.id,
        cloudIsRecovering: false,
      }),
    );
    // send cloud is recovered signal to fog
    this.websocketService.sendMessage<CloudIsRecoveringWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
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
    await this.nvrLiveSignalService.toConnected(nvrEntity);
    await this.mqttService.publish(
      nvrEntity.getCloudPubToFogMqttTopics().cloudRecoveryDataAck,
      'cloud recovery finished',
    );
  }

  async findFogNvrBySerialNumber(
    serialNumber: string,
  ): Promise<FogNvrProjection | undefined> {
    const nvrEntity: NvrEntity | undefined =
      await this.serviceProvider.queryBus.execute(
        new FindNvrBySerialNumberQuery(serialNumber),
      );
    if (!nvrEntity) return undefined;
    const {
      tenantId,
      serialNumber: persistedSerialNumber,
      accessToken,
      cloudIsRecovering,
    } = nvrEntity.getProps();
    return {
      id: nvrEntity.id,
      tenantId,
      serialNumber: persistedSerialNumber,
      accessToken,
      cloudIsRecovering,
    };
  }

  async resetFogCloudRecovery(nvrId: AggregateID) {
    await this.serviceProvider.commandBus.execute(
      new UpdateNvrCommand({ id: nvrId, cloudIsRecovering: false }),
    );
  }

  async completeFogCloudRecovery(serialNumber: string) {
    await this.postProcessCloudRecovery(
      await this.checkExistsNvrWithSerialNumber(serialNumber),
    );
  }

  async startFogCloudRecovery(nvrId: AggregateID) {
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(nvrId),
    );
    if (!nvrEntity) throw new Error('NVR does not exist');
    await this.preProcessCloudRecovery(nvrEntity);
    await this.nvrRunningConfigAndCommandService.stopAndRemoveAllRunningConfigs(
      nvrEntity,
    );
    const cameras: CameraEntity[] = await this.serviceProvider.queryBus.execute(
      new FindAllCamerasQuery({
        filter: {
          tenantId: nvrEntity.getProps().tenantId,
          nvrId: nvrEntity.id,
        },
      }),
    );
    for (const camera of cameras) {
      await this.cameraRunningConfigAndCommandService.stopAndRemoveAllRunningConfigs(
        camera,
      );
    }
    await this.dashboardApiForFogCommunicationManagerService.stopRunningConfigsForNvr(
      nvrEntity.getProps().tenantId,
      nvrEntity.id,
    );
  }
}
