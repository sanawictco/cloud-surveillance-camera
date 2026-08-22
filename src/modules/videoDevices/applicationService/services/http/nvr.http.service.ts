import { Injectable } from '@nestjs/common';
import { SanawApiVideoDeviceService } from 'src/extensions/sanawApi/services/sanawApiVideoDevice.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { WebsocketService } from 'src/extensions/websocket/websocket.service';
import { CameraMapper } from 'src/modules/videoDevices/infra/camera/camera.mapper';
import { NvrMapper } from 'src/modules/videoDevices/infra/nvr/nvr.mapper';
import { NvrRunningConfigService } from '../runningConfigs/nvrRunningConfig.service';
import { NvrValidator } from '../validators/nvr.validator';
import { DashboardApiForVideoDevicesService } from 'src/modules/dashboard/applicationService/apiForAnotherServices/dashboardApiForDevices.service';
import { NvrResponseDto } from 'src/modules/videoDevices/contracts/nvr/http/response/nvr.response.dto';
import { FindAllNvrsQuery } from '../../queries/nvr/findAllNvrs.queryHandler';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { AggregateID } from 'src/dddLib/core';
import { CreateNvrRequestDto } from 'src/modules/videoDevices/contracts/nvr/http/request/createNvr.request.dto';
import { CreateNvrCommand } from '../../commands/nvr/createNvr.command';
import { FindNvrByIdQuery } from '../../queries/nvr/findNvrById.queryHandler';
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
import { FindAllCamerasQuery } from '../../queries/camera/findAllCameras.queryHandler';
import { DashboardPageProjection } from 'src/dddLib/contracts/dashboardPage.projection';
import { AutoRegisterRequestDto } from 'src/modules/videoDevices/contracts/nvr/http/request/autoRegister.request.dto';
import { GetNvrDependenciesResposeDto } from 'src/modules/videoDevices/contracts/nvr/http/response/getNvrDependencies.response.dto';
import { NvrRegisterInfoResponseDto } from 'src/extensions/sanawApi/dtos/devices/response/nvrRegisterInfo.response.dto';
import { CreateNvrWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/createNvr.wsResponse.dto';
import { DeleteNvrWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/deleteNvr.wsResponse.dto';
import { FindAllTenantsQuery } from 'src/modules/tenants/applicationService/queries/findAllTenants.queryHandler';
import { TenantEntity } from 'src/modules/tenants/domain/tenant.entity';
import { BadRequestException } from '@nestjs/common';
import { AutoRegisterBatchConfig } from 'src/modules/videoDevices/contracts/nvr/dtos/autoSearchDevices.dto';
import { randomUUID } from 'node:crypto';

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
  ) {}
  async find(): Promise<NvrResponseDto[]> {
    const query = new FindAllNvrsQuery();
    const nvrEntities: NvrEntity[] =
      await this.serviceProvider.queryBus.execute(query);
    return this.nvrMapper.toResponseAll(nvrEntities);
  }

  async findOne(id: AggregateID): Promise<NvrResponseDto> {
    const nvrEntity = await this.nvrValidator.checkExistsNvrWithId(id);
    return this.nvrMapper.toResponse(nvrEntity);
  }

  async create(body: CreateNvrRequestDto): Promise<string> {
    await this.nvrValidator.checkExistsDuplicatedNvrBySerialNumber(
      body.serialNumber,
    );
    const { data }: NvrRegisterInfoResponseDto =
      await this.sanawApiVideoDeviceService.registerNvr(body.serialNumber);
    await this.nvrValidator.checkAvoidNvrDuplicationCreate(body.name);
    const tenants: TenantEntity[] = await this.serviceProvider.queryBus.execute(
      new FindAllTenantsQuery(),
    );
    if (tenants.length !== 1) {
      throw new BadRequestException('workspace tenant is not initialized');
    }
    const id = await this.serviceProvider.commandBus.execute(
      new CreateNvrCommand({
        name: body.name,
        tenantId: tenants[0]!.id,
        serialNumber: body.serialNumber,
        productModel: data.productModel,
        accessToken: data.accessToken,
        password: data.password,
        maxCameras: data.maxCameras,
      }),
    );
    const createdNvrEntity: NvrEntity =
      await this.serviceProvider.queryBus.execute(new FindNvrByIdQuery(id));
    const msgId = generateRandomMsgId();
    setTimeout(() => {
      this.websocketService.sendMessage<CreateNvrWsResponseDto>(
        this.websocketService.channels.DEVICES_SOCKET,
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
    const nvrEntity = await this.nvrValidator.checkExistsNvrWithId(id);
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    if (body.name)
      await this.nvrValidator.checkAvoidNvrDuplicationUpdate(body.name, id);
    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.UPDATE,
      body,
    );
  }

  async delete(id: AggregateID): Promise<string> {
    const nvrEntity = await this.nvrValidator.checkExistsNvrWithId(id);
    await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.DELETE,
    );
    setTimeout(async () => {
      await this.serviceProvider.commandBus.execute(
        new DeleteNvrCommand({
          id,
        }),
      );
    }, 2000);
    const softDeletedCameraIds: string[] = [];
    const dependentCameraEntities: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasQuery({
          filter: { nvrId: id },
        }),
      );
    for (const dependentCameraEntity of dependentCameraEntities)
      softDeletedCameraIds.push(dependentCameraEntity.id);
    const dependentPages: DashboardPageProjection[] =
      await this.dashboardApiforVideoDevicesService.getDependentPages(id);
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
      this.websocketService.sendMessage<DeleteNvrWsResponseDto>(
        this.websocketService.channels.DEVICES_SOCKET,
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
    const nvrEntity: NvrEntity =
      await this.nvrValidator.checkExistsNvrWithId(id);
    await this.nvrValidator.checkCanNvrBeActive(nvrEntity);
    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.ACTIVE,
      nvrEntity.getProps(),
    );
  }

  async inactive(id: AggregateID): Promise<string> {
    const nvrEntity: NvrEntity =
      await this.nvrValidator.checkExistsNvrWithId(id);
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
    const nvrEntity: NvrEntity =
      await this.nvrValidator.checkExistsNvrWithId(id);
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    return await this.NvrRunningConfigService.runConfigIfNotDuplicated(
      nvrEntity,
      NvrConfigs.SEARCH,
      undefined,
      randomUUID(),
    );
  }

  async autoRegister(body: AutoRegisterRequestDto): Promise<string> {
    const nvrEntity: NvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      body.nvrId,
    );
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    const batch: AutoRegisterBatchConfig =
      await this.nvrValidator.validateAndBuildAutoRegisterBatch(
        body,
        nvrEntity,
      );
    const msgId = randomUUID();
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
    await this.nvrValidator.checkExistsNvrWithId(id);

    const dependentCameras: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasQuery({ filter: { nvrId: id } }),
      );

    const dependentPages: DashboardPageProjection[] =
      await this.dashboardApiforVideoDevicesService.getDependentPages(id);
    return {
      cameras: this.cameraMapper.toResponseAll(dependentCameras),
      pages: dependentPages,
    };
  }
}
