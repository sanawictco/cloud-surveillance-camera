import { BadRequestException, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { MqttEventDataDto } from 'src/extensions/mqtt/dtos/mqttEventData.dto';
import { validateMqttPayload } from 'src/extensions/mqtt/validateMqttPayload';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { ActorDto } from 'src/modules/shared/dtos/actor.dto';
import { ActorPropsMsgIdDto } from 'src/modules/shared/dtos/actorPropsMsgId.dto';
import { GLOBAL_ERROR_EVENT } from 'src/utilities/exception.filter';
import { FindCameraByIdQuery } from '../applicationService/queries/camera/findCameraById.queryHandler';
import { FindNvrByIdQuery } from '../applicationService/queries/nvr/findNvrById.queryHandler';
import { CameraMqttService } from '../applicationService/services/mqtt/cameraMqtt.service';
import { NvrMqttService } from '../applicationService/services/mqtt/nvrMqtt.service';
import { VideoDeviceConfigQueueMsgDto } from '../applicationService/services/queues/videoDeviceConfig/videoDeviceConfigQueueMsg.dto';
import { VideoDeviceConfigQueueService } from '../applicationService/services/queues/videoDeviceConfig/videoDeviceQueue.service';
import { CameraRunningConfigAndCommandService } from '../applicationService/services/runningConfigs/cameraRunningConfigAndCommand.service';
import { NvrRunningConfigService } from '../applicationService/services/runningConfigs/nvrRunningConfig.service';
import {
  NvrLifecycleMqttResponseDto,
  NvrLiveSignalMqttResponseDto,
  NvrRegisterMqttResponseDto,
  NvrSearchMqttResponseDto,
} from '../contracts/nvr/mqtt/videoDeviceConfigResponse.dto';
import { CameraEntity } from '../domain/camera/camera.entity';
import { CameraSoftwareConfigs } from '../domain/camera/camera.type';
import { NvrEntity } from '../domain/nvr/nvr.entity';
import { NvrCloudSubOnFogMqttTopics, NvrConfigs } from '../domain/nvr/nvr.type';
import { VideoDeviceEntityTypes } from '../shared/valueObjects/videoDeviceEntityTypes';

const nvrConfigsArr: string[] = Object.values(NvrConfigs);

const CameraSoftwareConfigsArr: string[] = Object.values(CameraSoftwareConfigs);

type ParsedFogResponse =
  | { configType: NvrConfigs.SEARCH; payload: NvrSearchMqttResponseDto }
  | { configType: NvrConfigs.REGISTER; payload: NvrRegisterMqttResponseDto }
  | {
      configType: NvrConfigs.FOG_LIVE_SIGNAL;
      payload: NvrLiveSignalMqttResponseDto;
    }
  | { configType: 'lifecycle'; payload: NvrLifecycleMqttResponseDto };

@Injectable()
export class VideoDevicesConfigsMqttController {
  constructor(
    private readonly queue: VideoDeviceConfigQueueService,
    private readonly nvrMqttService: NvrMqttService,
    private readonly cameraMqttService: CameraMqttService,
    private readonly serviceProvider: ServiceProvider,
    private readonly nvrRunningConfigService: NvrRunningConfigService,
    private readonly cameraRunningConfigAndCommandService: CameraRunningConfigAndCommandService,
  ) {}

  @OnEvent(NvrCloudSubOnFogMqttTopics.videoDeviceConfigs)
  async handler(mqttEventData: MqttEventDataDto) {
    try {
      const { message } = mqttEventData;
      const topic = this.parseTopic(mqttEventData.topic);
      const response = this.parseResponse(message);
      const msgId = response.payload.msgId;
      const pendingMsg = await this.queue.getRepeatableMsg(msgId);
      if (!pendingMsg) throw new Error('msg not found');
      this.assertTopicOwnsQueuedMessage(topic, pendingMsg);
      const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
        new FindNvrByIdQuery(topic.nvrId),
      );
      if (nvrEntity.id !== pendingMsg.nvrId)
        throw new Error('nvrId dont match');
      const msg = await this.queue.getAndDeleteRepeatableMsg(msgId);
      if (!msg) throw new Error('msg not found');

      const actorProps: ActorDto = msg.metadata.actorProps as ActorDto;
      const { configType, data } = msg;
      const metadata: ActorPropsMsgIdDto = { actorProps, msgId };
      if (nvrConfigsArr.includes(configType))
        await this._nvrHandler({
          nvrEntity,
          configType,
          data,
          mqttData: response.payload,
          metadata,
        });
      else if (CameraSoftwareConfigsArr.includes(configType))
        await this._cameraHandler({
          configType,
          data,
          mqttData: response.payload,
          metadata,
        });
    } catch (err) {
      this.serviceProvider.eventEmitter.emit(GLOBAL_ERROR_EVENT, err);
    }
  }

  private async _nvrHandler(props: {
    nvrEntity: NvrEntity;
    configType: string;
    data: any;
    mqttData:
      | NvrSearchMqttResponseDto
      | NvrRegisterMqttResponseDto
      | NvrLiveSignalMqttResponseDto
      | NvrLifecycleMqttResponseDto;
    metadata: ActorPropsMsgIdDto;
  }) {
    const { configType, metadata, data, mqttData, nvrEntity } = props;
    await this.nvrRunningConfigService.doneAndUnlockConfig(
      nvrEntity,
      configType,
    );
    switch (configType) {
      case NvrConfigs.UPDATE:
        if (!metadata.actorProps) throw new Error('actor not found');
        await this.nvrMqttService.update(data, metadata);
        break;
      case NvrConfigs.ACTIVE:
        await this.nvrMqttService.active(nvrEntity, data, metadata);
        break;
      case NvrConfigs.IN_ACTIVE:
        await this.nvrMqttService.inactive(nvrEntity, data, metadata);
        break;
      case NvrConfigs.REGISTER:
        if (!metadata.actorProps) throw new Error('actor not found');
        await this.nvrMqttService.register(
          nvrEntity,
          data,
          mqttData as NvrRegisterMqttResponseDto,
        );
        break;
      case NvrConfigs.SEARCH:
        if (!metadata.actorProps) throw new Error('actor not found');
        await this.nvrMqttService.search(
          nvrEntity,
          metadata.msgId,
          mqttData as NvrSearchMqttResponseDto,
        );
        break;
      case NvrConfigs.FOG_LIVE_SIGNAL:
        await this.nvrMqttService.fogLiveSignal(nvrEntity);
        break;
      case NvrConfigs.ACTIVE_MULTI_CAMERAS:
        await this.nvrMqttService.activateCameras(data, metadata);
        break;
      case NvrConfigs.IN_ACTIVE_MULTI_CAMERAS:
        await this.nvrMqttService.inactivateCameras(data, metadata);
        break;
      case NvrConfigs.SOFT_DELETE_MULTI_CAMERAS:
        await this.nvrMqttService.softDeleteCameras(data, metadata);
        break;

      default:
        throw new Error(`software config not found ==> ${configType}`);
    }
  }

  private async _cameraHandler(props: {
    configType: string;
    data: any;
    mqttData: NvrLifecycleMqttResponseDto;
    metadata: ActorPropsMsgIdDto;
  }) {
    const { metadata, configType, data } = props;
    const cameraEntity: CameraEntity =
      await this.serviceProvider.queryBus.execute(
        new FindCameraByIdQuery(data.id || data.cameraId),
      );
    await this.cameraRunningConfigAndCommandService.doneAndUnLockConfig(
      cameraEntity,
      configType,
    );
    switch (configType) {
      case CameraSoftwareConfigs.UPDATE:
        await this.cameraMqttService.update(data, metadata);
        break;

      default:
        throw new Error(`software config not found ==> ${configType}`);
    }
  }

  private parseTopic(topic: string): { tenantId: string; nvrId: string } {
    const segments = topic.split('/');
    if (
      segments.length !== 5 ||
      segments[2] !== 'videoDevice' ||
      segments[3] !== 'Config' ||
      segments[4] !== 'sub' ||
      !segments[0] ||
      !segments[1]
    ) {
      throw new BadRequestException('invalid NVR config topic');
    }
    return { tenantId: segments[0], nvrId: segments[1] };
  }

  private assertTopicOwnsQueuedMessage(
    topic: { tenantId: string; nvrId: string },
    queued: VideoDeviceConfigQueueMsgDto,
  ): void {
    if (
      queued.nvrId !== topic.nvrId ||
      queued.tenantId !== topic.tenantId ||
      queued.metadata.entityId !== topic.nvrId ||
      queued.metadata.entityType !== VideoDeviceEntityTypes.NVR
    ) {
      throw new BadRequestException('queued NVR config identity mismatch');
    }
  }

  private parseResponse(message: string): ParsedFogResponse {
    const raw: unknown = JSON.parse(message);
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('invalid Fog config response');
    }
    if (Object.hasOwn(raw, 'macAddresses')) {
      return {
        configType: NvrConfigs.SEARCH,
        payload: validateMqttPayload(NvrSearchMqttResponseDto, raw),
      };
    }
    if (Object.hasOwn(raw, 'unRegisteredCameraSerialNumbers')) {
      return {
        configType: NvrConfigs.REGISTER,
        payload: validateMqttPayload(NvrRegisterMqttResponseDto, raw),
      };
    }
    if (Object.hasOwn(raw, 'disconnectedMacAddresses')) {
      return {
        configType: NvrConfigs.FOG_LIVE_SIGNAL,
        payload: validateMqttPayload(NvrLiveSignalMqttResponseDto, raw),
      };
    }
    return {
      configType: 'lifecycle',
      payload: validateMqttPayload(NvrLifecycleMqttResponseDto, raw),
    };
  }
}
