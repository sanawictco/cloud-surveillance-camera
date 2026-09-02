import { Injectable } from '@nestjs/common';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { ActorLogApiService } from 'src/modules/actorLogs/applicationService/services/actorLogApi.service';
import { CameraEntity } from '../../../domain/camera/camera.entity';
import { UpdateCameraRequestDto } from '../../../contracts/camera/http/updateCamera.request.dto';
@Injectable()
export class CameraActorLogService {
  constructor(private readonly actorLogApiService: ActorLogApiService) {}

  async update(_props: {
    cameraEntity: CameraEntity;
    actorId: string;
    updateCameraProps: {
      currentOrOldName: string;
      updatedProps: UpdateCameraRequestDto;
    };
  }) {
    const { cameraEntity, updateCameraProps } = _props;
    await this.actorLogApiService.registerActorLog({
      tenantId: cameraEntity.getProps().tenantId,
      actorId: _props.actorId,
      messageProps: {
        key: LanguageKeys.camera.actorLog.nameUpdated,
        params: [
          updateCameraProps.currentOrOldName,
          cameraEntity.getProps().serialNumber,
          updateCameraProps.updatedProps.name,
        ],
      },
    });
  }

  async create(_props: { cameraEntity: CameraEntity; actorId: string }) {
    const { cameraEntity, actorId } = _props;
    const { name, serialNumber } = cameraEntity.getProps();
    await this.actorLogApiService.registerActorLog({
      tenantId: cameraEntity.getProps().tenantId,
      actorId,
      messageProps: {
        key: LanguageKeys.camera.actorLog.created,
        params: [name, serialNumber],
      },
    });
  }

  async delete(props: { cameraEntity: CameraEntity; actorId?: string }) {
    const { cameraEntity, actorId } = props;
    const { name } = cameraEntity.getProps();
    await this.actorLogApiService.registerActorLog({
      tenantId: cameraEntity.getProps().tenantId,
      actorId,
      messageProps: {
        key: LanguageKeys.camera.actorLog.deleted,
        params: [name],
      },
    });
  }

  async active(props: { cameraEntity: CameraEntity; actorId: string }) {
    const { cameraEntity, actorId } = props;
    const { name } = cameraEntity.getProps();
    await this.actorLogApiService.registerActorLog({
      tenantId: cameraEntity.getProps().tenantId,
      actorId,
      messageProps: {
        key: LanguageKeys.camera.actorLog.activated,
        params: [name],
      },
    });
  }
  async inactive(props: { cameraEntity: CameraEntity; actorId: string }) {
    const { cameraEntity, actorId } = props;
    const { name } = cameraEntity.getProps();
    await this.actorLogApiService.registerActorLog({
      tenantId: cameraEntity.getProps().tenantId,
      actorId,
      messageProps: {
        key: LanguageKeys.camera.actorLog.inactivated,
        params: [name],
      },
    });
  }

  async recoveryFromTrash(props: {
    cameraEntity: CameraEntity;
    actorId?: string;
  }) {
    const { cameraEntity, actorId } = props;
    const { name } = cameraEntity.getProps();
    await this.actorLogApiService.registerActorLog({
      tenantId: cameraEntity.getProps().tenantId,
      actorId,
      messageProps: {
        key: LanguageKeys.camera.actorLog.recoveredFromTrash,
        params: [name],
      },
    });
  }

  async hardDelete(props: { cameraEntity: CameraEntity }) {
    const { cameraEntity } = props;
    const { name, serialNumber } = cameraEntity.getProps();
    await this.actorLogApiService.registerActorLog({
      tenantId: cameraEntity.getProps().tenantId,
      messageProps: {
        key: LanguageKeys.camera.actorLog.deleted,
        params: [name, serialNumber],
      },
    });
  }
}
