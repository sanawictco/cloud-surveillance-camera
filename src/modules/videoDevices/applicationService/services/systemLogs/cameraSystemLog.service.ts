import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { SystemLogService } from 'src/modules/systemLogs/applicationService/services/systemLog.service';
import { ConfigTypeMsgIdDto } from 'src/modules/shared/dtos/configTypeMsgId.dto';
import {
  SystemLogSections,
  SystemLogTypes,
} from 'src/modules/systemLogs/domain/systemLog.type';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { SystemLogWebSocketTypes } from 'src/modules/systemLogs/shares/systemLogWebSocketTypes.enum';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { CameraSoftwareConfigs } from 'src/modules/videoDevices/domain/camera/camera.type';

@Injectable()
export class CameraSystemLogService {
  constructor(
    @Inject(forwardRef(() => SystemLogService))
    private readonly systemLogService: SystemLogService,
  ) {}
  async handle(cameraEntity: CameraEntity, metadata: ConfigTypeMsgIdDto) {
    switch (metadata.configType) {
      case CameraSoftwareConfigs.UPDATE:
        return this.update(cameraEntity, metadata);
      default:
        break;
    }
  }

  async create(cameraEntity: CameraEntity, metadata: ConfigTypeMsgIdDto) {
    await this.systemLogService.createAndSend(
      {
        type: SystemLogTypes.WARNING,
        messageProps: {
          key: LanguageKeys.camera.systemLog.creationFailed,
          params: [cameraEntity.getProps().name],
        },
        section: SystemLogSections.VIDEO_DEVICES_CONFIG,
        entityId: cameraEntity.id,
      },
      SystemLogWebSocketTypes.CONFIG,
      metadata,
    );
  }

  async delete(cameraEntity: CameraEntity, metadata: ConfigTypeMsgIdDto) {
    await this.systemLogService.createAndSend(
      {
        type: SystemLogTypes.WARNING,
        messageProps: {
          key: LanguageKeys.camera.systemLog.deletionFailed,
          params: [cameraEntity.getProps().name],
        },
        section: SystemLogSections.VIDEO_DEVICES_CONFIG,
        entityId: cameraEntity.id,
      },
      SystemLogWebSocketTypes.CONFIG,
      metadata,
    );
  }

  async update(cameraEntity: CameraEntity, metadata: ConfigTypeMsgIdDto) {
    await this.systemLogService.createAndSend(
      {
        type: SystemLogTypes.WARNING,
        messageProps: {
          key: LanguageKeys.camera.systemLog.updateFailed,
          params: [cameraEntity.getProps().name],
        },
        section: SystemLogSections.VIDEO_DEVICES_CONFIG,
        entityId: cameraEntity.id,
      },
      SystemLogWebSocketTypes.CONFIG,
      metadata,
    );
  }
}
