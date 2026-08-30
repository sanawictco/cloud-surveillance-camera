import { BadRequestException, Injectable } from '@nestjs/common';
import { CacheService } from 'src/extensions/caching/cache.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { AutoRegisterRequestDto } from 'src/modules/videoDevices/contracts/nvr/http/request/autoRegister.request.dto';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { FindAllCamerasForTenantQuery } from '../../queries/camera/findAllCameras.queryHandler';
import {
  FindNvrByIdForTenantQuery,
  FindNvrByIdQuery,
} from '../../queries/nvr/findNvrById.queryHandler';
import { FindNvrBySerialNumberQuery } from '../../queries/nvr/findNvrBySerialNumber.queryHandler';
import {
  FindNvrByNameForTenantQuery,
  FindNvrByNameQuery,
} from '../../queries/nvr/findNvrByName.queryHandler';
import {
  AutoRegisterBatchConfig,
  NvrPrivateSearchCache,
} from 'src/modules/videoDevices/contracts/nvr/dtos/autoSearchDevices.dto';

@Injectable()
export class NvrValidator {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly cacheService: CacheService<NvrPrivateSearchCache>,
  ) {}

  async validateAndBuildAutoRegisterBatch(
    request: AutoRegisterRequestDto,
    nvrEntity: NvrEntity,
  ): Promise<AutoRegisterBatchConfig> {
    if (request.addedCameras.length + request.deletedCameras.length === 0) {
      throw new BadRequestException('at least one camera change is required');
    }
    const overlap = request.addedCameras.some((serialNumber) =>
      request.deletedCameras.includes(serialNumber),
    );
    if (overlap)
      throw new BadRequestException('camera cannot be added and deleted');

    const cached = await this.cacheService.get(
      nvrEntity.getCacheKeys().autoSearchNvrData!,
    );
    if (!cached)
      throw new BadRequestException('auto-search result has expired');

    const cachedAdditions = new Map(
      cached.addedCameras.map((camera) => [camera.serialNumber, camera]),
    );
    const cachedDeletions = new Map(
      cached.deletedCameras.map((camera) => [camera.serialNumber, camera]),
    );
    if (request.addedCameras.some((serial) => !cachedAdditions.has(serial))) {
      throw new BadRequestException('camera is not an addable search result');
    }
    if (request.deletedCameras.some((serial) => !cachedDeletions.has(serial))) {
      throw new BadRequestException('camera is not a deletion search result');
    }

    const currentCameras: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasForTenantQuery(nvrEntity.getProps().tenantId, {
          filter: { nvrId: nvrEntity.id, isDeleted: { $ne: true } },
        }),
      );
    const currentSerialNumbers = new Set(
      currentCameras.map((camera) => camera.getProps().serialNumber),
    );
    if (
      request.deletedCameras.some((serial) => !currentSerialNumbers.has(serial))
    ) {
      throw new BadRequestException('camera does not belong to this NVR');
    }
    if (
      currentCameras.length -
        request.deletedCameras.length +
        request.addedCameras.length >
      nvrEntity.getProps().maxCameras
    ) {
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.nvr.errorResponse.badRequest.camerasExceedsNvrCapacity,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    }

    return {
      nvrId: nvrEntity.id,
      tenantId: nvrEntity.getProps().tenantId,
      addedCameras: request.addedCameras.map((serialNumber) => {
        const camera = cachedAdditions.get(serialNumber)!;
        return {
          id: camera.cameraAggregateId,
          tenantId: nvrEntity.getProps().tenantId,
          name: camera.name,
          serialNumber,
          productModel: camera.productModel,
          macAddress: camera.macAddress,
          nvrId: nvrEntity.id,
          username: camera.username,
          password: camera.password,
          port: camera.port,
          streams: JSON.parse(camera.streams),
          hasPtz: camera.hasPtz,
          hasAudio: camera.hasAudio,
        };
      }),
      deletedCameras: request.deletedCameras.map((serialNumber) =>
        cachedDeletions.get(serialNumber)!,
      ),
    };
  }

  async checkNvrShouldBeActiveAndHasConnectedStatus(nvrEntity: NvrEntity) {
    if (!nvrEntity.getProps().isActive)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.nvr.errorResponse.badRequest.isNotActive,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    else if (!nvrEntity.isConnected())
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.nvr.errorResponse.badRequest.liveSignalFailed,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
  }

  async checkExistsNvrWithId(
    id: string,
    tenantId?: string,
  ): Promise<NvrEntity> {
    const query = tenantId
      ? new FindNvrByIdForTenantQuery(tenantId, id)
      : new FindNvrByIdQuery(id);
    const nvrEntity: NvrEntity =
      await this.serviceProvider.queryBus.execute(query);
    if (!nvrEntity) throw new BadRequestException('the nvr not exist');
    return nvrEntity;
  }

  async checkExistsNvrBySerialNumber(serialNumber: string): Promise<NvrEntity> {
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrBySerialNumberQuery(serialNumber),
    );
    if (!nvrEntity) throw new BadRequestException('the nvr not exist');
    return nvrEntity;
  }
  async checkExistsDuplicatedNvrBySerialNumber(
    serialNumber: string,
  ): Promise<void> {
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrBySerialNumberQuery(serialNumber),
    );
    if (nvrEntity)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.nvr.errorResponse.badRequest.duplicatedNvr,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
  }

  async checkCanNvrBeActive(nvrEntity: NvrEntity) {
    if (nvrEntity.getProps().isActive)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.nvr.errorResponse.badRequest.hasAlreadyActivated,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
  }

  async checkCanNvrBeInActive(nvrEntity: NvrEntity) {
    if (!nvrEntity.getProps().isActive)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.nvr.errorResponse.badRequest.hasAlreadyInactivated,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
  }

  async checkAvoidNvrDuplicationCreate(
    name: string,
    tenantId?: string,
  ): Promise<boolean> {
    const query = tenantId
      ? new FindNvrByNameForTenantQuery(tenantId, name)
      : new FindNvrByNameQuery(name);
    const nvrEntity: NvrEntity =
      await this.serviceProvider.queryBus.execute(query);
    if (nvrEntity)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.nvr.errorResponse.badRequest.nameIsDuplicated,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    return true;
  }

  async checkAvoidNvrDuplicationUpdate(
    name: string,
    id: string,
    tenantId?: string,
  ): Promise<boolean> {
    const query = tenantId
      ? new FindNvrByNameForTenantQuery(tenantId, name)
      : new FindNvrByNameQuery(name);
    const nvrEntity: NvrEntity =
      await this.serviceProvider.queryBus.execute(query);
    if (nvrEntity && nvrEntity.id !== id)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.nvr.errorResponse.badRequest.nameIsDuplicated,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    return true;
  }

  async checkNvrShouldNotBeInCloudRecoveryMode(nvrEntity: NvrEntity) {
    if (nvrEntity.getProps().cloudIsRecovering)
      throw new BadRequestException('nvr is in cloud recovery mode');
  }
}
