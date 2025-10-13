import { BadRequestException, Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindCameraByIdQuery } from '../../../queries/camera/findCameraById.queryHandler';
import { FindCameraByNameQuery } from '../../../queries/camera/findCameraByName.queryHandler';

@Injectable()
export class CameraValidator {
  constructor(private readonly serviceProvider: ServiceProvider) {}
  async checkCameraShouldBeActiveAndHasConnectedStatus(
    cameraEntity: CameraEntity,
  ): Promise<void> {
    if (!cameraEntity.getProps().isActive)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.camera.errorResponse.badRequest.isInactive,
          this.serviceProvider.userInfoService.getProps()?.lang,
        ),
      );
    else if (!cameraEntity.isConnected())
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.camera.errorResponse.badRequest.liveSignalIsDisconnected,
          this.serviceProvider.userInfoService.getProps()?.lang,
        ),
      );
  }

  async checkExistsCameraWihtId(id: string): Promise<CameraEntity> {
    const cameraEntity: CameraEntity =
      await this.serviceProvider.queryBus.execute(new FindCameraByIdQuery(id));
    if (!cameraEntity)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.camera.errorResponse.badRequest.doesNotExists,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    return cameraEntity;
  }

  async checkCanCameraBeActive(cameraEntity: CameraEntity): Promise<void> {
    if (cameraEntity.getProps().isActive)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.camera.errorResponse.badRequest.hasAlreadyActivated,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
  }

  async checkCanCameraBeInActive(cameraEntity: CameraEntity): Promise<void> {
    if (!cameraEntity.getProps().isActive)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.camera.errorResponse.badRequest.hasAlreadyInactivated,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
  }

  async checkAvoidCameraDuplicationUpdate(
    name: string,
    id: string,
  ): Promise<boolean> {
    const cameraEntity: CameraEntity =
      await this.serviceProvider.queryBus.execute(
        new FindCameraByNameQuery(name),
      );
    if (cameraEntity && cameraEntity.id !== id)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.camera.errorResponse.badRequest.nameIsDuplicated,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    return true;
  }

  async checkCameraShouldBeActive(cameraEntity: CameraEntity): Promise<void> {
    if (!cameraEntity.getProps().isActive)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.camera.errorResponse.badRequest.isInactive,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
  }
}
