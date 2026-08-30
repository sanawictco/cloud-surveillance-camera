import { BadRequestException, Injectable } from '@nestjs/common';
import { AggregateID, BaseEntityProps } from 'src/dddLib/core';
import { CacheService } from 'src/extensions/caching/cache.service';
import { SanawApiVideoDeviceService } from 'src/extensions/sanawApi/services/sanawApiVideoDevice.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { WebsocketService } from 'src/extensions/websocket/websocket.service';
import { ActorPropsMsgIdDto } from 'src/modules/shared/dtos/actorPropsMsgId.dto';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { CameraResponseDto } from 'src/modules/videoDevices/contracts/camera/http/camera.response.dto';
import {
  AutoRegisterBatchConfig,
  NvrPrivateSearchCache,
  PrivateSearchCamera,
  SanitizedNvrCameraDto,
} from 'src/modules/videoDevices/contracts/nvr/dtos/autoSearchDevices.dto';
import {
  NvrRegisterMqttResponseDto,
  NvrSearchMqttResponseDto,
} from 'src/modules/videoDevices/contracts/nvr/mqtt/videoDeviceConfigResponse.dto';
import { ActiveMultiCamerastWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/activeMultiCameras.wsResponse.dto';
import { ActiveNvrWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/activeNvr.wsResponse.dto';
import { InActiveMultiCamerastWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/inactiveMultiCameras.wsResponse.dto';
import { InActiveNvrWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/inactiveNvr.wsResponse.dto';
import { RegisterNvrWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/registerNvr.wsResponse.dto';
import { SearchNvrWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/searchNvr.wsResponse.dto';
import { SoftDeleteMultiCamerastWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/softDeleteMultiCameras.wsResponse.dto';
import { UpdateNvrWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/updateNvr.wsResponse.dto';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import {
  NvrConfigs,
  NvrProps,
  NvrWebSocketConfigTypes,
} from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { CameraMapper } from 'src/modules/videoDevices/infra/camera/camera.mapper';
import { NvrMapper } from 'src/modules/videoDevices/infra/nvr/nvr.mapper';
import { ActiveCameraCommand } from '../../commands/camera/activeCamera.command';
import { CreateCameraCommand } from '../../commands/camera/createCamera.command';
import { InActiveCameraCommand } from '../../commands/camera/inactiveCamera.command';
import { SoftDeleteCameraCommand } from '../../commands/camera/softDeleteCamera.command';
import { UpdateCameraCommand } from '../../commands/camera/updateCamera.command';
import { ActiveNvrCommand } from '../../commands/nvr/activeNvr.command';
import { InActiveNvrCommand } from '../../commands/nvr/inactiveNvr.command';
import { UpdateNvrCommand } from '../../commands/nvr/updateNvr.command';
import { FindAllCamerasForTenantQuery } from '../../queries/camera/findAllCameras.queryHandler';
import { FindCameraByIdForTenantQuery } from '../../queries/camera/findCameraById.queryHandler';
import { FindCameraBySerialNumberForTenantQuery } from '../../queries/camera/findCameraBySerialNumber.queryHandler';
import { FindNvrByIdForTenantQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { NvrLiveSignalService } from '../liveSignals/nvrLiveSignal.service';
import { VideoDeviceConfigQueueMsgDto } from '../queues/videoDeviceConfig/videoDeviceConfigQueueMsg.dto';

const SEARCH_CACHE_TTL_SECONDS = 1800;

@Injectable()
export class NvrMqttService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly nvrMapper: NvrMapper,
    private readonly cameraMapper: CameraMapper,
    private readonly websocketService: WebsocketService,
    private readonly nvrLiveSignalService: NvrLiveSignalService,
    private readonly sanawApi: SanawApiVideoDeviceService,
    private readonly cache: CacheService<NvrPrivateSearchCache>,
  ) {}
  async update(
    tenantId: string,
    data: NvrProps & BaseEntityProps,
    metadata: ActorPropsMsgIdDto,
  ): Promise<void> {
    const { actorProps, msgId } = metadata;
    await this.serviceProvider.commandBus.execute(
      new UpdateNvrCommand({
        ...(data as object),
        id: data.id,
        tenantId,
        actorProps,
      }),
    );
    const updatedNvrEntity: NvrEntity =
      await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(tenantId, data.id),
      );
    this.websocketService.sendMessage<UpdateNvrWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
      {
        type: WebSocketTypes.CONFIG,
        data: this.nvrMapper.toResponse(updatedNvrEntity),
        message: { msgKey: LanguageKeys.nvr.response.socket.updated },
        metadata: {
          configType: NvrWebSocketConfigTypes.UPDATE,
          msgId,
        },
      },
    );
  }

  async active(
    tenantId: string,
    nvrEntity: NvrEntity,
    data: { id: AggregateID },
    metadata: ActorPropsMsgIdDto,
  ): Promise<void> {
    if (nvrEntity.getProps().isActive) return;
    this.assertTargetsNvr(nvrEntity, data.id);
    await this.serviceProvider.commandBus.execute(
      new ActiveNvrCommand({
        id: data.id,
        tenantId,
        actorProps: metadata.actorProps,
      }),
    );
    const activatedNvrEntity: NvrEntity =
      await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(tenantId, data.id),
      );

    this.websocketService.sendMessage<ActiveNvrWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
      {
        type: WebSocketTypes.CONFIG,
        data: this.nvrMapper.toResponse(activatedNvrEntity),
        message: { msgKey: LanguageKeys.nvr.response.socket.activated },
        metadata: {
          configType: NvrWebSocketConfigTypes.ACTIVE,
          msgId: metadata.msgId,
        },
      },
    );
  }

  async inactive(
    tenantId: string,
    nvrEntity: NvrEntity,
    data: { id: AggregateID },
    metadata: ActorPropsMsgIdDto,
  ) {
    const { actorProps, msgId } = metadata;
    if (!nvrEntity.getProps().isActive) return;
    this.assertTargetsNvr(nvrEntity, data.id);

    const dependentCameraEntities: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasForTenantQuery(tenantId, {
          filter: {
            nvrId: nvrEntity.id,
            isActive: true,
            isDeleted: { $ne: true },
          },
        }),
      );
    const inactivatedCameras: CameraResponseDto[] =
      this.cameraMapper.toResponseAll(dependentCameraEntities);
    for (let camera of inactivatedCameras) camera.isActive = false;

    await this.serviceProvider.commandBus.execute(
      new InActiveNvrCommand({
        id: data.id,
        tenantId,
        actorProps,
      }),
    );
    const inactivatedNvrEntity: NvrEntity =
      await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(tenantId, data.id),
      );
    this.websocketService.sendMessage<InActiveNvrWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
      {
        type: WebSocketTypes.CONFIG,
        data: {
          nvr: this.nvrMapper.toResponse(inactivatedNvrEntity),
          cameras: inactivatedCameras,
        },
        message: {
          msgKey: LanguageKeys.nvr.response.socket.inactivated,
          msgParams: [nvrEntity.getProps().name],
        },
        metadata: {
          configType: NvrWebSocketConfigTypes.IN_ACTIVE,
          msgId,
        },
      },
    );
  }

  async fogLiveSignal(nvrEntity: NvrEntity) {
    await this.nvrLiveSignalService.toConnected(nvrEntity);
  }

  async liveSignal(_nvrEntity: NvrEntity, _disconnectedCameras: string[]) {
    //TODO
  }

  async search(
    nvr: NvrEntity,
    msgId: string,
    payload: NvrSearchMqttResponseDto,
  ): Promise<void> {
    const discoveredMacs = new Set(
      payload.macAddresses.map(normalizeMacAddress),
    );
    const currentCameras: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasForTenantQuery(nvr.getProps().tenantId, {
          filter: { nvrId: nvr.id, isDeleted: { $ne: true } },
        }),
      );
    const currentMacs = new Set(
      currentCameras.map((camera) =>
        normalizeMacAddress(camera.getProps().macAddress),
      ),
    );
    const deletedCameras = currentCameras
      .filter(
        (camera) =>
          !discoveredMacs.has(
            normalizeMacAddress(camera.getProps().macAddress),
          ),
      )
      .map(toSanitizedCamera);
    const newMacAddresses = [...discoveredMacs].filter(
      (macAddress) => !currentMacs.has(macAddress),
    );

    let additions: PrivateSearchCamera[] = [];
    if (newMacAddresses.length > 0) {
      const requestedMacs = new Set(newMacAddresses);
      const management = await this.sanawApi.getNvrCameraSearchInfo(
        nvr.id,
        newMacAddresses,
      );
      additions = management.data.cameras
        .filter((camera) =>
          requestedMacs.has(normalizeMacAddress(camera.macAddress)),
        )
        .map((camera) => ({
          managementCameraId: camera.id,
          cameraAggregateId: camera.cameraAggregateId,
          serialNumber: camera.serialNumber,
          productModel: camera.productModel,
          username: camera.username,
          password: camera.password,
          macAddress: normalizeMacAddress(camera.macAddress),
          streams: camera.streams,
          port: camera.port,
          hasPtz: camera.hasPtz,
          hasAudio: camera.hasAudio,
          name: `Camera ${camera.serialNumber}`,
        }));
    }

    const privateCache: NvrPrivateSearchCache = {
      addedCameras: additions,
      deletedCameras,
    };
    await this.cache.set(
      nvr.getCacheKeys().autoSearchNvrData!,
      privateCache,
      SEARCH_CACHE_TTL_SECONDS,
    );
    const stored = await this.cache.get(nvr.getCacheKeys().autoSearchNvrData!);
    if (!stored) throw new Error('private NVR search cache is unavailable');

    const websocketMessage: SearchNvrWsResponseDto =
      additions.length === 0 && deletedCameras.length === 0
        ? {
            type: WebSocketTypes.CONFIG,
            data: { nvrId: nvr.id },
            message: {
              msgKey:
                LanguageKeys.nvr.response.socket.allConnectedCamerasAreUpToDate,
            },
            metadata: { configType: NvrWebSocketConfigTypes.SEARCH, msgId },
          }
        : {
            type: WebSocketTypes.CONFIG,
            data: {
              nvrId: nvr.id,
              videoDevices: [
                {
                  addedCameras: additions.map((camera) => ({
                    productModel: camera.productModel,
                    serialNumber: camera.serialNumber,
                    name: camera.name,
                    hasPtz: camera.hasPtz,
                    hasAudio: camera.hasAudio,
                  })),
                  deletedCameras,
                },
              ],
            },
            metadata: { configType: NvrWebSocketConfigTypes.SEARCH, msgId },
          };

    this.websocketService.sendMessage<SearchNvrWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
      websocketMessage,
    );
  }

  async register(
    nvr: NvrEntity,
    queued: VideoDeviceConfigQueueMsgDto,
    payload: NvrRegisterMqttResponseDto,
  ) {
    const batch = queued.data as AutoRegisterBatchConfig;
    if (batch.nvrId !== nvr.id || batch.tenantId !== nvr.getProps().tenantId) {
      throw new BadRequestException(
        'queued NVR registration identity mismatch',
      );
    }
    const selectedAdditions = new Set(
      batch.addedCameras.map((camera) => camera.serialNumber),
    );
    if (
      payload.unRegisteredCameraSerialNumbers.some(
        (serialNumber) => !selectedAdditions.has(serialNumber),
      )
    ) {
      throw new BadRequestException('Fog registration result is not selected');
    }
    const failedAdditions = new Set(payload.unRegisteredCameraSerialNumbers);
    const successfulAdditions = batch.addedCameras.filter(
      (camera) => !failedAdditions.has(camera.serialNumber),
    );

    const tenantId = nvr.getProps().tenantId;
    const addedCameras: SanitizedNvrCameraDto[] = [];
    for (const camera of successfulAdditions) {
      const existingById: CameraEntity | undefined = camera.id
        ? await this.serviceProvider.queryBus.execute(
            new FindCameraByIdForTenantQuery(tenantId, camera.id),
          )
        : undefined;
      const existingOnNvr: CameraEntity | undefined =
        await this.serviceProvider.queryBus.execute(
          new FindCameraBySerialNumberForTenantQuery(
            tenantId,
            camera.serialNumber,
            nvr.id,
          ),
        );
      if (
        existingById &&
        existingById.getProps().serialNumber !== camera.serialNumber
      ) {
        throw new BadRequestException('camera registration identity mismatch');
      }
      if (camera.id && existingOnNvr && camera.id !== existingOnNvr.id) {
        throw new BadRequestException('camera registration identity mismatch');
      }
      const existing: CameraEntity | undefined = existingById ?? existingOnNvr;
      if (existing) {
        const existingProps = existing.getProps();
        if (existingProps.isDeleted) {
          await this.serviceProvider.commandBus.execute(
            new UpdateCameraCommand({
              id: existing.id,
              tenantId,
              nvrId: nvr.id,
              isDeleted: false,
              actorProps: queued.metadata.actorProps,
            }),
          );
          await this.serviceProvider.commandBus.execute(
            new ActiveCameraCommand({
              id: existing.id,
              tenantId,
              actorProps: queued.metadata.actorProps,
            }),
          );
          const restored: CameraEntity =
            await this.serviceProvider.queryBus.execute(
              new FindCameraByIdForTenantQuery(tenantId, existing.id),
            );
          addedCameras.push(toSanitizedCamera(restored));
        } else {
          if (existingProps.nvrId !== nvr.id) {
            throw new BadRequestException('camera belongs to another NVR');
          }
          addedCameras.push(toSanitizedCamera(existing));
        }
        continue;
      }
      await this.serviceProvider.commandBus.execute(
        new CreateCameraCommand({
          originId: camera.id,
          // Stamp the NVR's persisted tenant and ID rather than the per-camera
          // fields carried in the queued batch: those are payload data, so a
          // stale batch entry must not decide which tenant owns a new camera.
          tenantId,
          nvrId: nvr.id,
          name: camera.name,
          productModel: camera.productModel,
          username: camera.username,
          password: camera.password,
          macAddress: camera.macAddress,
          port: camera.port,
          streams: camera.streams,
          hasPtz: camera.hasPtz,
          hasAudio: camera.hasAudio,
          serialNumber: camera.serialNumber,
          actorProps: queued.metadata.actorProps,
        }),
      );
      addedCameras.push({
        id: camera.id!,
        serialNumber: camera.serialNumber,
        productModel: camera.productModel,
        name: camera.name,
      });
    }

    for (const camera of batch.deletedCameras) {
      const existing: CameraEntity | undefined =
        await this.serviceProvider.queryBus.execute(
          new FindCameraBySerialNumberForTenantQuery(
            tenantId,
            camera.serialNumber,
            nvr.id,
          ),
        );
      if (!existing) continue;
      if (existing.getProps().nvrId !== nvr.id) {
        throw new BadRequestException('camera belongs to another NVR');
      }
      if (existing.getProps().isDeleted) continue;
      await this.serviceProvider.commandBus.execute(
        new SoftDeleteCameraCommand({
          id: existing.id,
          tenantId,
          actorProps: queued.metadata.actorProps,
        }),
      );
    }

    await Promise.all([
      this.cache.delete(nvr.getCacheKeys().autoSearchNvrData!),
      this.cache.delete(nvr.getCacheKeys().namingCamerasData!),
    ]);
    this.websocketService.sendMessage<RegisterNvrWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
      {
        type: WebSocketTypes.CONFIG,
        data: {
          nvrId: nvr.id,
          addedCameras,
          deletedCameras: batch.deletedCameras,
          unRegisteredCameraSerialNumbers: [
            ...payload.unRegisteredCameraSerialNumbers,
          ],
        },
        metadata: {
          configType: NvrWebSocketConfigTypes.REGISTER,
          msgId: queued.msgId,
        },
      },
    );
  }

  async activateCameras(
    tenantId: string,
    nvrEntity: NvrEntity,
    data: { id: AggregateID; cameraIds: AggregateID[] },
    metadata: ActorPropsMsgIdDto,
  ) {
    const { actorProps, msgId } = metadata;
    this.assertTargetsNvr(nvrEntity, data.id);
    const activatedCameraEntities: CameraEntity[] = [];
    const cameraIds = data.cameraIds;
    for (const cameraId of cameraIds) {
      const cameraEntity = await this.requireCameraOnNvr(
        tenantId,
        nvrEntity,
        cameraId,
      );
      const { isActive, isDeleted } = cameraEntity.getProps();
      if (isActive || isDeleted) continue;
      await this.serviceProvider.commandBus.execute(
        new ActiveCameraCommand({
          id: cameraId,
          tenantId,
          actorProps,
        }),
      );
      const activatedCameraEntity: CameraEntity =
        await this.serviceProvider.queryBus.execute(
          new FindCameraByIdForTenantQuery(tenantId, cameraEntity.id),
        );
      activatedCameraEntities.push(activatedCameraEntity);
    }
    if (activatedCameraEntities.length)
      this.websocketService.sendMessage<ActiveMultiCamerastWsResponseDto>(
        this.websocketService.channels.VIDEO_DEVICES_SOCKET,
        {
          type: WebSocketTypes.CONFIG,
          data: this.cameraMapper.toResponseAll(activatedCameraEntities),
          message: {
            msgKey:
              activatedCameraEntities.length > 1
                ? LanguageKeys.nvr.response.socket.multiCameraActivated
                : LanguageKeys.camera.response.socket.activated,
          },
          metadata: {
            configType: NvrConfigs.ACTIVE_MULTI_CAMERAS,
            msgId,
          },
        },
      );
  }

  async inactivateCameras(
    tenantId: string,
    nvrEntity: NvrEntity,
    data: { id: AggregateID; cameraIds: AggregateID[] },
    metadata: ActorPropsMsgIdDto,
  ) {
    const { actorProps, msgId } = metadata;
    this.assertTargetsNvr(nvrEntity, data.id);
    const cameraIds = data.cameraIds;
    const inactivatedCameraEntities: CameraEntity[] = [];
    for (const cameraId of cameraIds) {
      const cameraEntity = await this.requireCameraOnNvr(
        tenantId,
        nvrEntity,
        cameraId,
      );
      const { isActive } = cameraEntity.getProps();
      if (!isActive) continue;
      await this.serviceProvider.commandBus.execute(
        new InActiveCameraCommand({
          id: cameraId,
          tenantId,
          actorProps,
        }),
      );
      const inactivatedCameraEntity: CameraEntity =
        await this.serviceProvider.queryBus.execute(
          new FindCameraByIdForTenantQuery(tenantId, cameraEntity.id),
        );
      inactivatedCameraEntities.push(inactivatedCameraEntity);
    }
    if (inactivatedCameraEntities.length)
      this.websocketService.sendMessage<InActiveMultiCamerastWsResponseDto>(
        this.websocketService.channels.VIDEO_DEVICES_SOCKET,
        {
          type: WebSocketTypes.CONFIG,
          data: {
            cameras: this.cameraMapper.toResponseAll(inactivatedCameraEntities),
          },
          message: {
            msgKey:
              inactivatedCameraEntities.length > 1
                ? LanguageKeys.nvr.response.socket.multiCameraInactivated
                : LanguageKeys.camera.response.socket.inactivated,
          },
          metadata: {
            configType: NvrConfigs.IN_ACTIVE_MULTI_CAMERAS,
            msgId,
          },
        },
      );
  }

  async softDeleteCameras(
    tenantId: string,
    nvrEntity: NvrEntity,
    data: { id: AggregateID; cameraIds: AggregateID[] },
    metadata: ActorPropsMsgIdDto,
  ) {
    const { actorProps, msgId } = metadata;
    this.assertTargetsNvr(nvrEntity, data.id);
    const cameraIds = data.cameraIds;
    const allDependentRuleChains: any = [];
    for (const cameraId of cameraIds) {
      const cameraEntity = await this.requireCameraOnNvr(
        tenantId,
        nvrEntity,
        cameraId,
      );
      if (cameraEntity.getProps().isDeleted) continue;
      await this.serviceProvider.commandBus.execute(
        new SoftDeleteCameraCommand({
          id: cameraEntity.id,
          tenantId,
          actorProps,
        }),
      );

      for (let ruleChain of allDependentRuleChains) ruleChain.isActive = false;
    }
    this.websocketService.sendMessage<SoftDeleteMultiCamerastWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
      {
        type: WebSocketTypes.CONFIG,
        data: { cameraIds },
        message: {
          msgKey: LanguageKeys.camera.response.socket.softDeleted,
        },
        metadata: {
          configType: NvrConfigs.SOFT_DELETE_MULTI_CAMERAS,
          msgId,
        },
      },
    );
  }

  /**
   * The queued payload names the NVR it claims to target. It must be the NVR
   * the topic and the persisted record already resolved to, otherwise a device
   * could act on a sibling NVR by supplying a different `data.id`.
   */
  private assertTargetsNvr(nvrEntity: NvrEntity, targetId: AggregateID): void {
    if (targetId !== nvrEntity.id) {
      throw new BadRequestException('queued NVR identity mismatch');
    }
  }

  /**
   * Camera IDs arrive inside a queued payload, so each one is re-read under the
   * validated tenant and must belong to the validated NVR. A camera ID from
   * another tenant or another NVR fails closed instead of being mutated.
   */
  private async requireCameraOnNvr(
    tenantId: string,
    nvrEntity: NvrEntity,
    cameraId: AggregateID,
  ): Promise<CameraEntity> {
    const cameraEntity: CameraEntity | undefined =
      await this.serviceProvider.queryBus.execute(
        new FindCameraByIdForTenantQuery(tenantId, cameraId),
      );
    if (!cameraEntity || cameraEntity.getProps().nvrId !== nvrEntity.id) {
      throw new BadRequestException('queued camera identity mismatch');
    }
    return cameraEntity;
  }
}

function normalizeMacAddress(macAddress: string): string {
  const compact = macAddress.replaceAll(/[:-]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(compact)) {
    throw new BadRequestException('invalid MAC address');
  }
  return compact.match(/.{2}/g)!.join(':');
}

function toSanitizedCamera(camera: CameraEntity): SanitizedNvrCameraDto {
  const props = camera.getProps();
  return {
    id: camera.id,
    serialNumber: props.serialNumber,
    productModel: props.productModel,
    name: props.name,
  };
}
