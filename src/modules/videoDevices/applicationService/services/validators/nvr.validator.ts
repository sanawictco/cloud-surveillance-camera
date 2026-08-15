import { BadRequestException, Injectable } from '@nestjs/common';
import { CacheService } from 'src/extensions/caching/cache.service';
import {
  AutoScanAllCamerasInformationResDto,
  ScanedCamera,
} from 'src/extensions/sanawApi/dtos/devices/response/allDevicesAutoScanInformation.response.dto';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { CamerasNamesDto } from 'src/modules/videoDevices/contracts/camera/camerasNames.dto';
import { AutoRegisterRequestDto } from 'src/modules/videoDevices/contracts/nvr/http/request/autoRegister.request.dto';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { CreateCameraProps } from 'src/modules/videoDevices/domain/camera/camera.type';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { v4 } from 'uuid';
import { FindAllCamerasQuery } from '../../queries/camera/findAllCameras.queryHandler';
import { FindAllDeletedCamerasByDeletedSerialNumbersQuery } from '../../queries/camera/findAllDeletedCamerasByDeletedSerialNumbers.queryHandler';
import { FindCameraBySerialNumberQuery } from '../../queries/camera/findCameraBySerialNumber.queryHandler';
import { FindNvrByIdQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { FindNvrBySerialNumberQuery } from '../../queries/nvr/findNvrBySerialNumber.queryHandler';
import { FindNvrByNameQuery } from '../../queries/nvr/findNvrByName.queryHandler';
import { AutoRegisterFullContent } from 'src/modules/videoDevices/contracts/nvr/dtos/autoRegisterDevices.dto';

@Injectable()
export class NvrValidator {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly cacheService: CacheService<AutoScanAllCamerasInformationResDto>,
    private readonly CamerasNamesCacheService: CacheService<CamerasNamesDto>,
  ) {}

  private isValidAddedCameras(
    addedCameraMacAddresses: string[],
    scanedCameras: ScanedCamera[],
  ): boolean {
    let isValid;
    for (const macAddress of addedCameraMacAddresses) {
      isValid = false;
      for (const scanedCamera of scanedCameras) {
        if (macAddress === scanedCamera.macAddress) isValid = true;
      }
      if (!isValid) return false;
    }
    return true;
  }

  private async isValidDeletedCameras(
    deletedCamerasSerialNumbers: string[],
  ): Promise<boolean> {
    const removeableCameras: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllDeletedCamerasByDeletedSerialNumbersQuery({
          filter: {
            deletedCamerasSerialNumbers: deletedCamerasSerialNumbers,
          },
        }),
      );
    if (removeableCameras.length !== deletedCamerasSerialNumbers.length)
      return false;
    return true;
  }

  private async checkAutoRegisterCamerasAreValid(
    nvrEntity: NvrEntity,
    addedCamerasMacAddresses: string[],
    deletedCameras: string[],
  ): Promise<ScanedCamera[]> {
    let applyedChange = false;
    let existAddedCamera = false;
    if (addedCamerasMacAddresses.length || deletedCameras.length)
      applyedChange = true;
    if (addedCamerasMacAddresses.length) existAddedCamera = true;

    if (!applyedChange)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.camera.errorResponse.badRequest.hasNoChange,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );

    let scanedCameras: ScanedCamera[] = [];
    if (existAddedCamera) {
      const apiResult: AutoScanAllCamerasInformationResDto | undefined =
        await this.cacheService.get(
          nvrEntity.getCacheKeys().autoSearchNvrData ?? '',
        );
      if (!apiResult)
        throw new BadRequestException(
          this.serviceProvider.translatorService.translateByName(
            LanguageKeys.camera.errorResponse.badRequest.autoRegisterTimeout,
            this.serviceProvider.userInfoService.getProps().lang,
          ),
        );
      scanedCameras = apiResult.data.cameras;
    }
    // check addedCamerasMacAddresses, deletedCamerasMacAddresses
    const addedCamerasMacAddressesAreValid = this.isValidAddedCameras(
      addedCamerasMacAddresses,
      scanedCameras,
    );
    //check deletedCamerasMacAddresses
    const deletedCamerasMacAddressesAreValid =
      await this.isValidDeletedCameras(deletedCameras);

    if (
      !addedCamerasMacAddressesAreValid ||
      !deletedCamerasMacAddressesAreValid
    )
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.others.errorResponse.badRequest.invalidRequest,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );

    if (!scanedCameras.length) {
      //check deletedCameras
      const deletedCamerasAreValid =
        await this.isValidDeletedCameras(deletedCameras);

      if (!deletedCamerasAreValid)
        throw new BadRequestException(
          this.serviceProvider.translatorService.translateByName(
            LanguageKeys.others.errorResponse.badRequest.invalidRequest,
            this.serviceProvider.userInfoService.getProps().lang,
          ),
        );
    }

    //check nvr maxCount camera limitation
    const addedCameraCount = addedCamerasMacAddresses.length;
    const currentCameraEntities: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasQuery({ filter: { nvrId: nvrEntity.id } }),
      );
    const currentCameraCount = currentCameraEntities.length;
    if (addedCameraCount + currentCameraCount > nvrEntity.getProps().maxCameras)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.nvr.errorResponse.badRequest.camerasExceedsNvrCapacity,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );

    return scanedCameras;
  }

  private async createAutoRegisterFullContent(
    addedCamerasSerialNumbers: string[],
    deletedCamerasSerialNumbers: string[],
    cameraNames: CamerasNamesDto,
    scanedCameras: ScanedCamera[],
    nvrEntity: NvrEntity,
  ): Promise<{
    finalAddedCameras: CreateCameraProps[];
    finalDeletedCamerasSerialNumbers: string[];
  }> {
    const finalAddedCameras: CreateCameraProps[] = [];
    const finalDeletedCamerasSerialNumbers: string[] = [];

    //addedCameras
    for (const serialNumber of addedCamerasSerialNumbers) {
      const cameraEntiy: CameraEntity =
        await this.serviceProvider.queryBus.execute(
          new FindCameraBySerialNumberQuery(serialNumber),
        );
      if (cameraEntiy) throw new BadRequestException('camera already exists1');
      const scanedCamera: ScanedCamera | undefined = scanedCameras.find(
        (record) => record.serialNumber === serialNumber,
      );
      if (!scanedCamera)
        throw new BadRequestException('scanedCamera not found1');
      finalAddedCameras.push({
        id: v4(),
        tenantId: nvrEntity.getProps().tenantId,
        name: cameraNames[serialNumber] ?? '',
        serialNumber: serialNumber,
        productModel: scanedCamera.productModel,
        macAddress: scanedCamera.macAddress,
        nvrId: nvrEntity.id,
        username: scanedCamera.username,
        password: scanedCamera.password,
        port: scanedCamera.port,
        streams: JSON.parse(scanedCamera.streams),
        hasPtz: scanedCamera.hasPtz,
        hasAudio: scanedCamera.hasAudio,
      });
    }

    //deletedCameras
    finalDeletedCamerasSerialNumbers.push(...deletedCamerasSerialNumbers);

    return { finalAddedCameras, finalDeletedCamerasSerialNumbers };
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

  checkNvrHatShouldBeConnected(nvrEnity: NvrEntity) {
    if (!(nvrEnity.getProps() as { isHatConnected?: boolean }).isHatConnected)
      throw new BadRequestException('nvr hat is disconnected');
  }

  async checkExistsNvrWithId(id: string): Promise<NvrEntity> {
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(id),
    );
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

  async checkAvoidNvrDuplicationCreate(name: string): Promise<boolean> {
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByNameQuery(name),
    );
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
  ): Promise<boolean> {
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByNameQuery(name),
    );
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
