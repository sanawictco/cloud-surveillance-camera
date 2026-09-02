import { BadRequestException, Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindCameraByIdForTenantQuery } from '../../queries/camera/findCameraById.queryHandler';
import {
  FindCameraByNameForTenantQuery,
} from '../../queries/camera/findCameraByName.queryHandler';

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

  async checkExistsCameraWihtId(
    id: string,
    tenantId: string,
  ): Promise<CameraEntity> {
    const cameraEntity: CameraEntity =
      await this.serviceProvider.queryBus.execute(
        new FindCameraByIdForTenantQuery(tenantId, id),
      );
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
    tenantId: string,
  ): Promise<boolean> {
    // Uniqueness is per tenant, as for NVR names.
    const cameraEntity: CameraEntity =
      await this.serviceProvider.queryBus.execute(
        new FindCameraByNameForTenantQuery(tenantId, name),
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

  checkCameraShoudBeSoftDeleted(cameraEntity: CameraEntity): void {
    if (!cameraEntity.getProps().isDeleted)
      throw new BadRequestException("the camera isn't soft deleted");
  }

  checkCameraShoudNotBeSoftDeleted(cameraEntity: CameraEntity): void {
    if (cameraEntity.getProps().isDeleted)
      throw new BadRequestException('the camera has been soft deleted');
  }
}
