import { BadRequestException, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { MqttEventDataDto } from 'src/extensions/mqtt/dtos/mqttEventData.dto';
import { validateMqttPayload } from 'src/extensions/mqtt/validateMqttPayload';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { ActorDto } from 'src/modules/shared/dtos/actor.dto';
import { ActorPropsMsgIdDto } from 'src/modules/shared/dtos/actorPropsMsgId.dto';
import { GLOBAL_ERROR_EVENT } from 'src/utilities/exception.filter';
import { FindCameraByIdForTenantQuery } from '../applicationService/queries/camera/findCameraById.queryHandler';
import { FindNvrByIdForTenantQuery } from '../applicationService/queries/nvr/findNvrById.queryHandler';
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
import {
  parseNvrConfigResponseTopic,
  videoDeviceConfigPubTopic,
  type ParsedDeviceResponseTopic,
} from '../shared/deviceMqttTopics';
import { EntityTypes } from '../shared/valueObjects/entityTypes';

const nvrConfigsArr: string[] = Object.values(NvrConfigs);

const CameraSoftwareConfigsArr: string[] = Object.values(CameraSoftwareConfigs);

enum FogResponseKind {
  SEARCH = NvrConfigs.SEARCH,
  REGISTER = NvrConfigs.REGISTER,
  LIVE_SIGNAL = NvrConfigs.FOG_LIVE_SIGNAL,
  LIFECYCLE = 'lifecycle',
}

type ParsedFogResponse =
  | { kind: FogResponseKind.SEARCH; payload: NvrSearchMqttResponseDto }
  | { kind: FogResponseKind.REGISTER; payload: NvrRegisterMqttResponseDto }
  | {
      kind: FogResponseKind.LIVE_SIGNAL;
      payload: NvrLiveSignalMqttResponseDto;
    }
  | { kind: FogResponseKind.LIFECYCLE; payload: NvrLifecycleMqttResponseDto };

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
      const pendingMsg = await this.queue.getRepeatableMsg(
        topic.tenantId,
        topic.nvrId,
        msgId,
      );
      if (!pendingMsg) {
        // Idempotent consumption: a duplicate or late response whose pending
        // config was already consumed (by this handler or the expiry handler)
        // must not re-run side effects or surface as an error.
        this.serviceProvider.logger.debug(
          `no pending device config for tenantId=${topic.tenantId} nvrId=${topic.nvrId} msgId=${msgId}`,
        );
        return;
      }
      this.assertTopicOwnsQueuedEnvelope(topic, pendingMsg);
      this.assertResponseMatchesQueuedConfig(response, pendingMsg);
      // Read the NVR under the validated topic tenant. An unscoped read by ID
      // would load a foreign-tenant NVR and only then compare tenants, which
      // makes the check an assertion instead of an isolation boundary.
      const nvrEntity: NvrEntity | undefined =
        await this.serviceProvider.queryBus.execute(
          new FindNvrByIdForTenantQuery(topic.tenantId, topic.nvrId),
        );
      this.assertNvrOwnsTopic(topic, nvrEntity);
      const actorProps: ActorDto = pendingMsg.metadata.actorProps as ActorDto;
      const { configType, data } = pendingMsg;
      const metadata: ActorPropsMsgIdDto = { actorProps, msgId };
      let cameraEntity: CameraEntity | undefined;
      if (pendingMsg.metadata.entityType === EntityTypes.NVR) {
        this.assertNvrOwnsQueuedMessage(nvrEntity, pendingMsg);
        if (!nvrConfigsArr.includes(configType)) {
          throw new BadRequestException('queued NVR config type mismatch');
        }
        await this._nvrHandler({
          tenantId: topic.tenantId,
          nvrEntity,
          configType,
          data,
          mqttData: response.payload,
          metadata,
        });
      } else if (pendingMsg.metadata.entityType === EntityTypes.CAMERA) {
        cameraEntity = await this.serviceProvider.queryBus.execute(
          new FindCameraByIdForTenantQuery(
            topic.tenantId,
            pendingMsg.metadata.entityId,
          ),
        );
        this.assertCameraOwnsQueuedMessage(
          topic,
          nvrEntity,
          cameraEntity,
          pendingMsg,
        );
        if (!CameraSoftwareConfigsArr.includes(configType)) {
          throw new BadRequestException('queued camera config type mismatch');
        }
        cameraEntity = await this._cameraHandler({
          tenantId: topic.tenantId,
          cameraEntity,
          configType,
          data,
          mqttData: response.payload,
          metadata,
        });
      } else {
        throw new BadRequestException('queued entity type is unsupported');
      }

      const removed = await this.queue.getAndDeleteRepeatableMsg(
        topic.tenantId,
        topic.nvrId,
        msgId,
      );
      if (!removed) throw new Error('failed to consume processed config');

      if (pendingMsg.metadata.entityType === EntityTypes.NVR) {
        const unlocked = await this.nvrRunningConfigService.doneAndUnlockConfig(
          nvrEntity,
          configType,
          msgId,
        );
        if (!unlocked) throw new Error('failed to unlock processed NVR config');
      } else if (cameraEntity) {
        const unlocked =
          await this.cameraRunningConfigAndCommandService.doneAndUnLockConfig(
            cameraEntity,
            configType,
            msgId,
          );
        if (!unlocked) {
          throw new Error('failed to unlock processed camera config');
        }
      }
    } catch (err) {
      this.serviceProvider.eventEmitter.emit(GLOBAL_ERROR_EVENT, err);
    }
  }

  private async _nvrHandler(props: {
    tenantId: string;
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
    const { tenantId, configType, metadata, data, mqttData, nvrEntity } = props;
    switch (configType) {
      case NvrConfigs.UPDATE:
        if (!metadata.actorProps) throw new Error('actor not found');
        await this.nvrMqttService.update(tenantId, data, metadata);
        break;
      case NvrConfigs.ACTIVE:
        await this.nvrMqttService.active(tenantId, nvrEntity, data, metadata);
        break;
      case NvrConfigs.IN_ACTIVE:
        await this.nvrMqttService.inactive(tenantId, nvrEntity, data, metadata);
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
        await this.nvrMqttService.activateCameras(
          tenantId,
          nvrEntity,
          data,
          metadata,
        );
        break;
      case NvrConfigs.IN_ACTIVE_MULTI_CAMERAS:
        await this.nvrMqttService.inactivateCameras(
          tenantId,
          nvrEntity,
          data,
          metadata,
        );
        break;
      case NvrConfigs.SOFT_DELETE_MULTI_CAMERAS:
        await this.nvrMqttService.softDeleteCameras(
          tenantId,
          nvrEntity,
          data,
          metadata,
        );
        break;

      default:
        throw new Error(`software config not found ==> ${configType}`);
    }
  }

  private async _cameraHandler(props: {
    tenantId: string;
    cameraEntity: CameraEntity;
    configType: string;
    data: any;
    mqttData: NvrLifecycleMqttResponseDto;
    metadata: ActorPropsMsgIdDto;
  }): Promise<CameraEntity> {
    const { tenantId, metadata, configType, data, cameraEntity } = props;
    switch (configType) {
      case CameraSoftwareConfigs.UPDATE:
        await this.cameraMqttService.update(tenantId, data, metadata);
        break;

      default:
        throw new Error(`software config not found ==> ${configType}`);
    }
    return cameraEntity;
  }

  /**
   * Parses the response topic with the shared parser, which validates the
   * complete shape and UUID identity.
   */
  private parseTopic(topic: string): ParsedDeviceResponseTopic {
    try {
      return parseNvrConfigResponseTopic(topic);
    } catch {
      throw new BadRequestException('invalid NVR config topic');
    }
  }

  private assertTopicOwnsQueuedEnvelope(
    topic: ParsedDeviceResponseTopic,
    queued: VideoDeviceConfigQueueMsgDto,
  ): void {
    const now = Date.now();
    if (
      queued.nvrId !== topic.nvrId ||
      queued.tenantId !== topic.tenantId ||
      typeof queued.metadata.issuedAt !== 'number' ||
      typeof queued.metadata.expiresAt !== 'number' ||
      queued.metadata.issuedAt > now ||
      queued.metadata.expiresAt <= queued.metadata.issuedAt ||
      queued.metadata.expiresAt < now ||
      queued.metadata.topic !==
        videoDeviceConfigPubTopic(topic.tenantId, topic.nvrId)
    ) {
      throw new BadRequestException('queued config topic identity mismatch');
    }
  }

  private assertResponseMatchesQueuedConfig(
    response: ParsedFogResponse,
    queued: VideoDeviceConfigQueueMsgDto,
  ): void {
    let expectedKind: ParsedFogResponse['kind'] = FogResponseKind.LIFECYCLE;
    switch (queued.configType) {
      case NvrConfigs.SEARCH:
        expectedKind = FogResponseKind.SEARCH;
        break;
      case NvrConfigs.REGISTER:
        expectedKind = FogResponseKind.REGISTER;
        break;
      case NvrConfigs.FOG_LIVE_SIGNAL:
        expectedKind = FogResponseKind.LIVE_SIGNAL;
        break;
    }
    if (response.kind !== expectedKind) {
      throw new BadRequestException(
        'Fog response does not match queued config',
      );
    }
  }

  private assertNvrOwnsTopic(
    topic: ParsedDeviceResponseTopic,
    nvr: NvrEntity | undefined,
  ): asserts nvr is NvrEntity {
    if (
      !nvr ||
      nvr.id !== topic.nvrId ||
      nvr.getProps().tenantId !== topic.tenantId
    ) {
      throw new BadRequestException('NVR config topic ownership mismatch');
    }
  }

  private assertNvrOwnsQueuedMessage(
    nvr: NvrEntity,
    queued: VideoDeviceConfigQueueMsgDto,
  ): void {
    if (queued.metadata.entityId !== nvr.id) {
      throw new BadRequestException('queued NVR config identity mismatch');
    }
  }

  private assertCameraOwnsQueuedMessage(
    topic: ParsedDeviceResponseTopic,
    nvr: NvrEntity,
    camera: CameraEntity | undefined,
    queued: VideoDeviceConfigQueueMsgDto,
  ): asserts camera is CameraEntity {
    if (!camera) {
      throw new BadRequestException('queued camera does not exist');
    }
    const cameraProps = camera.getProps();
    if (
      camera.id !== queued.metadata.entityId ||
      cameraProps.nvrId !== nvr.id ||
      cameraProps.tenantId !== topic.tenantId
    ) {
      throw new BadRequestException('queued camera config identity mismatch');
    }

    const data = queued.data as { id?: unknown; cameraId?: unknown };
    const payloadEntityId = data.id ?? data.cameraId;
    if (
      payloadEntityId !== undefined &&
      payloadEntityId !== queued.metadata.entityId
    ) {
      throw new BadRequestException('queued camera payload identity mismatch');
    }
  }

  private parseResponse(message: string): ParsedFogResponse {
    const raw: unknown = JSON.parse(message);
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('invalid Fog config response');
    }
    if (Object.hasOwn(raw, 'macAddresses')) {
      return {
        kind: FogResponseKind.SEARCH,
        payload: validateMqttPayload(NvrSearchMqttResponseDto, raw),
      };
    }
    if (Object.hasOwn(raw, 'unRegisteredCameraSerialNumbers')) {
      return {
        kind: FogResponseKind.REGISTER,
        payload: validateMqttPayload(NvrRegisterMqttResponseDto, raw),
      };
    }
    if (Object.hasOwn(raw, 'disconnectedMacAddresses')) {
      return {
        kind: FogResponseKind.LIVE_SIGNAL,
        payload: validateMqttPayload(NvrLiveSignalMqttResponseDto, raw),
      };
    }
    return {
      kind: FogResponseKind.LIFECYCLE,
      payload: validateMqttPayload(NvrLifecycleMqttResponseDto, raw),
    };
  }
}
