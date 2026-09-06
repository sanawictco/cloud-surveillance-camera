import { BadRequestException, Injectable } from '@nestjs/common';
import { SanawApiVideoDeviceService } from 'src/extensions/sanawApi/services/sanawApiVideoDevice.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { WebsocketService } from 'src/extensions/websocket/websocket.service';
import { CameraMapper } from 'src/modules/videoDevices/infra/camera/camera.mapper';
import { NvrMapper } from 'src/modules/videoDevices/infra/nvr/nvr.mapper';
import { NvrRunningConfigService } from '../runningConfigs/nvrRunningConfig.service';
import { NvrValidator } from '../validators/nvr.validator';
import { DashboardApiForVideoDevicesService } from 'src/modules/dashboard/applicationService/apiForAnotherServices/dashboardApiForDevices.service';
import { NvrResponseDto } from 'src/modules/videoDevices/contracts/nvr/http/response/nvr.response.dto';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { AggregateID } from 'src/dddLib/core';
import { CreateNvrRequestDto } from 'src/modules/videoDevices/contracts/nvr/http/request/createNvr.request.dto';
import { CreateNvrCommand } from '../../commands/nvr/createNvr.command';
import { FindNvrByIdForTenantQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { generateRandomMsgId } from 'src/dddLib/utils/randomIdGenerator';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import {
  NvrConfigs,
  NvrWebSocketConfigTypes,
} from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { UpdateNvrRequestDto } from 'src/modules/videoDevices/contracts/nvr/http/request/updateNvr.request.dto';
import { DeleteNvrCommand } from '../../commands/nvr/deleteNvr.command';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindAllCamerasForTenantQuery } from '../../queries/camera/findAllCameras.queryHandler';
import { DashboardPageProjection } from 'src/dddLib/contracts/dashboardPage.projection';
import { AutoRegisterRequestDto } from 'src/modules/videoDevices/contracts/nvr/http/request/autoRegister.request.dto';
import { GetNvrDependenciesResposeDto } from 'src/modules/videoDevices/contracts/nvr/http/response/getNvrDependencies.response.dto';
import { NvrRegisterInfoResponseDto } from 'src/extensions/sanawApi/dtos/devices/response/nvrRegisterInfo.response.dto';
import { CreateNvrWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/createNvr.wsResponse.dto';
import { DeleteNvrWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/deleteNvr.wsResponse.dto';
import { AutoRegisterBatchConfig } from 'src/modules/videoDevices/contracts/nvr/dtos/autoSearchDevices.dto';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
import { FindAllNvrsForTenantQuery } from '../../queries/nvr/findAllNvrs.queryHandler';
import { CameraValidator } from '../validators/camera.validator';

@Injectable()
export class NvrsHttpService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly nvrMapper: NvrMapper,
    private readonly cameraMapper: CameraMapper,
    private readonly sanawApiVideoDeviceService: SanawApiVideoDeviceService,
    private readonly websocketService: WebsocketService,
    private readonly NvrRunningConfigService: NvrRunningConfigService,
    private readonly nvrValidator: NvrValidator,
    private readonly dashboardApiforVideoDevicesService: DashboardApiForVideoDevicesService,
    private readonly cameraValidator: CameraValidator,
  ) {}
  async find(): Promise<NvrResponseDto[]> {
    const tenantId = UserInfoService.requireTenantId();
    const query = new FindAllNvrsForTenantQuery(tenantId);
    const nvrEntities: NvrEntity[] =
      await this.serviceProvider.queryBus.execute(query);
    return this.nvrMapper.toResponseAll(nvrEntities);
  }

  async findOne(id: AggregateID): Promise<NvrResponseDto> {
    const tenantId = UserInfoService.requireTenantId();
    const nvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      id,
      tenantId,
    );
    return this.nvrMapper.toResponse(nvrEntity);
  }

  async create(body: CreateNvrRequestDto): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    await this.nvrValidator.checkExistsDuplicatedNvrBySerialNumber(
      body.serialNumber,
    );
    const { data }: NvrRegisterInfoResponseDto =
      await this.sanawApiVideoDeviceService.registerNvr(body.serialNumber);
    await this.nvrValidator.checkAvoidNvrDuplicationCreate(body.name, tenantId);
    const id = await this.serviceProvider.commandBus.execute(
      new CreateNvrCommand({
        name: body.name,
        tenantId,
        serialNumber: body.serialNumber,
        productModel: data.productModel,
        accessToken: data.accessToken,
        password: data.password,
        maxCameras: data.maxCameras,
      }),
    );
    const createdNvrEntity: NvrEntity =
      await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(tenantId, id),
      );
    const msgId = generateRandomMsgId();
    setTimeout(() => {
      this.websocketService.sendTenantMessage<CreateNvrWsResponseDto>(
        tenantId,
        this.websocketService.channels.VIDEO_DEVICES_SOCKET,
        {
          type: WebSocketTypes.CONFIG,
          data: this.nvrMapper.toResponse(createdNvrEntity),
          message: { msgKey: LanguageKeys.nvr.response.socket.created },
          metadata: {
            configType: NvrWebSocketConfigTypes.CREATE,
            msgId,
          },
        },
      );
    }, 1000);

    return msgId;
  }

  async update(id: AggregateID, body: UpdateNvrRequestDto): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    const nvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      id,
      tenantId,
    );
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    if (body.name)
      await this.nvrValidator.checkAvoidNvrDuplicationUpdate(
        body.name,
        id,
        tenantId,
      );
    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.UPDATE,
      body,
    );
  }

  async delete(id: AggregateID): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    const nvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      id,
      tenantId,
    );
    await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.DELETE,
    );
    setTimeout(async () => {
      await this.serviceProvider.commandBus.execute(
        new DeleteNvrCommand({
          id,
          tenantId,
        }),
      );
    }, 2000);
    const softDeletedCameraIds: string[] = [];
    const dependentCameraEntities: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasForTenantQuery(tenantId, {
          filter: { nvrId: id, isDeleted: { $ne: true } },
        }),
      );
    for (const dependentCameraEntity of dependentCameraEntities)
      softDeletedCameraIds.push(dependentCameraEntity.id);
    const dependentPages: DashboardPageProjection[] =
      await this.dashboardApiforVideoDevicesService.getDependentPages(
        tenantId,
        id,
      );
    const pageIds: { widgets: string[]; liveDiagrams: string[] } = {
      widgets: [],
      liveDiagrams: [],
    };

    for (const page of dependentPages) {
      if (page.type === 'widget') pageIds.widgets.push(page.id);
      else pageIds.liveDiagrams.push(page.id);
    }
    const msgId = generateRandomMsgId();
    setTimeout(() => {
      this.websocketService.sendTenantMessage<DeleteNvrWsResponseDto>(
        tenantId,
        this.websocketService.channels.VIDEO_DEVICES_SOCKET,
        {
          type: WebSocketTypes.CONFIG,
          data: {
            id,
            softDeletedCameraIds,
            pageIds,
          },
          message: { msgKey: LanguageKeys.nvr.response.socket.deleted },

          metadata: {
            configType: NvrWebSocketConfigTypes.DELETE,
            msgId,
          },
        },
      );
    }, 1000);
    return msgId;
  }

  async active(id: AggregateID): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    const nvrEntity: NvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      id,
      tenantId,
    );
    await this.nvrValidator.checkCanNvrBeActive(nvrEntity);
    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.ACTIVE,
      nvrEntity.getProps(),
    );
  }

  async inactive(id: AggregateID): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    const nvrEntity: NvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      id,
      tenantId,
    );
    await this.nvrValidator.checkCanNvrBeInActive(nvrEntity);
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    await this.nvrValidator.checkNvrShouldNotBeInCloudRecoveryMode(nvrEntity);
    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.IN_ACTIVE,
    );
  }

  async autoSearch(id: AggregateID): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    const nvrEntity: NvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      id,
      tenantId,
    );
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.SEARCH,
      undefined,
      generateRandomMsgId(),
    );
  }

  async autoRegister(body: AutoRegisterRequestDto): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    const nvrEntity: NvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      body.nvrId,
      tenantId,
    );
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    const batch: AutoRegisterBatchConfig =
      await this.nvrValidator.validateAndBuildAutoRegisterBatch(
        body,
        nvrEntity,
      );
    const msgId = generateRandomMsgId();
    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.REGISTER,
      batch,
      msgId,
    );
  }

  async getDependencies(
    id: AggregateID,
  ): Promise<GetNvrDependenciesResposeDto> {
    const tenantId = UserInfoService.requireTenantId();
    await this.nvrValidator.checkExistsNvrWithId(id, tenantId);

    const dependentCameras: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasForTenantQuery(tenantId, {
          filter: { nvrId: id, isDeleted: { $ne: true } },
        }),
      );

    const dependentPages: DashboardPageProjection[] =
      await this.dashboardApiforVideoDevicesService.getDependentPages(
        tenantId,
        id,
      );
    return {
      cameras: this.cameraMapper.toResponseAll(dependentCameras),
      pages: dependentPages,
    };
  }

  async softDeleteCameras(
    nvrId: AggregateID,
    cameraIds: AggregateID[],
  ): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    const nvrEntity: NvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      nvrId,
      tenantId,
    );

    for (const cameraId of cameraIds) {
      const cameraEntity = await this.cameraValidator.checkExistsCameraWithId(
        cameraId,
        tenantId,
      );
      this.cameraValidator.checkCameraShoudNotBeSoftDeleted(cameraEntity);
      if (cameraEntity.getProps().nvrId !== nvrEntity.id) {
        throw new BadRequestException('camera is not connected to the nvr');
      }
    }
    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.SOFT_DELETE_MULTI_CAMERAS,
      cameraIds,
    );
  }

  async activateCameras(
    nvrId: AggregateID,
    cameraIds: AggregateID[],
  ): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    const nvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      nvrId,
      tenantId,
    );
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    for (const cameraId of cameraIds) {
      const cameraEntity: CameraEntity =
        await this.cameraValidator.checkExistsCameraWithId(cameraId, tenantId);
      this.cameraValidator.checkCameraShoudNotBeSoftDeleted(cameraEntity);
      await this.cameraValidator.checkCanCameraBeActive(cameraEntity);
      if (cameraEntity.getProps().nvrId !== nvrEntity.id) {
        throw new BadRequestException('camera is not connected to the nvr');
      }
    }

    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.ACTIVE_MULTI_CAMERAS,
      cameraIds,
    );
  }

  async inactivateCameras(
    nvrId: AggregateID,
    cameraIds: AggregateID[],
  ): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    const nvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      nvrId,
      tenantId,
    );
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    for (const cameraId of cameraIds) {
      const cameraEntity: CameraEntity =
        await this.cameraValidator.checkExistsCameraWithId(cameraId, tenantId);
      this.cameraValidator.checkCameraShoudNotBeSoftDeleted(cameraEntity);
      await this.cameraValidator.checkCameraShouldBeActiveAndHasConnectedStatus(
        cameraEntity,
      );
      if (cameraEntity.getProps().nvrId !== nvrEntity.id) {
        throw new BadRequestException('camera is not connected to the nvr');
      }
    }
    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.IN_ACTIVE_MULTI_CAMERAS,
      cameraIds,
    );
  }
}
