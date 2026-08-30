import { Injectable } from '@nestjs/common';
import { SystemLogService } from 'src/modules/systemLogs/applicationService/services/systemLog.service';

import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';

import {
  SystemLogProps,
  SystemLogSections,
  SystemLogTypes,
} from 'src/modules/systemLogs/domain/systemLog.type';
import { SystemLogWebSocketTypes } from 'src/modules/systemLogs/shares/systemLogWebSocketTypes.enum';

import { ConfigTypeMsgIdDto } from 'src/modules/shared/dtos/configTypeMsgId.dto';
import { NvrLiveSignalService } from '../liveSignals/nvrLiveSignal.service';
import { UpdateNvrCommand } from '../../commands/nvr/updateNvr.command';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import {
  NvrConfigs,
  NvrSystemLogConfigTypes,
  NvrSystemLogDataTypes,
} from 'src/modules/videoDevices/domain/nvr/nvr.type';

@Injectable()
export class NvrSystemLogService {
  constructor(
    private readonly systemLogService: SystemLogService,
    private readonly nvrLiveSignalService: NvrLiveSignalService,
    private readonly serviceProvider: ServiceProvider,
  ) {}
  async handle(
    entity: NvrEntity,
    metadata: ConfigTypeMsgIdDto,
    fogSystemLog?: {
      systemLogProps: SystemLogProps;
      nvrHardwareConfigType?: string;
    },
  ) {
    const { configType, msgId } = metadata;
    if (fogSystemLog)
      return await this.handleFogSystemLog(entity, metadata, fogSystemLog);
    switch (configType) {
      case NvrConfigs.UPDATE:
        return await this.update(entity, msgId);
      case NvrConfigs.ACTIVE:
        return await this.active(entity, msgId);
      case NvrConfigs.IN_ACTIVE:
        return await this.inactive(entity, msgId);
      case NvrConfigs.FOG_LIVE_SIGNAL:
        return await this.fogLiveSignal(entity);
      case NvrConfigs.CLOUD_IS_RECOVERING:
        return await this.cloudIsRecovered(entity);
      default:
        return;
    }
  }

  private async update(entity: NvrEntity, msgId: string) {
    const nvrProps = entity.getProps();
    await this.systemLogService.createAndSend(
      {
        tenantId: nvrProps.tenantId,
        type: SystemLogTypes.WARNING,
        messageProps: {
          key: LanguageKeys.nvr.systemLog.updateFailed,
          params: [nvrProps.name],
        },
        section: SystemLogSections.VIDEO_DEVICES_CONFIG,
        entityId: nvrProps.id,
      },
      SystemLogWebSocketTypes.CONFIG,
      { configType: NvrSystemLogConfigTypes.UPDATE, msgId },
    );
  }

  private async active(entity: NvrEntity, msgId: string) {
    const nvrProps = entity.getProps();
    await this.systemLogService.createAndSend(
      {
        tenantId: nvrProps.tenantId,
        type: SystemLogTypes.WARNING,
        messageProps: {
          key: LanguageKeys.nvr.systemLog.activationFailed,
          params: [nvrProps.name],
        },
        section: SystemLogSections.VIDEO_DEVICES_CONFIG,
        entityId: nvrProps.id,
      },
      SystemLogWebSocketTypes.CONFIG,
      { configType: NvrSystemLogConfigTypes.ACTIVE, msgId },
    );
  }

  private async inactive(entity: NvrEntity, msgId: string) {
    const nvrProps = entity.getProps();
    await this.systemLogService.createAndSend(
      {
        tenantId: nvrProps.tenantId,
        type: SystemLogTypes.WARNING,
        messageProps: {
          key: LanguageKeys.nvr.systemLog.inactivationFailed,
          params: [nvrProps.name],
        },
        section: SystemLogSections.VIDEO_DEVICES_CONFIG,
        entityId: nvrProps.id,
      },
      SystemLogWebSocketTypes.CONFIG,
      { configType: NvrSystemLogConfigTypes.IN_ACTIVE, msgId },
    );
  }

  private async fogLiveSignal(entity: NvrEntity) {
    const nvrProps = entity.getProps();
    if (!entity.isDisconnected())
      await this.systemLogService.createAndSend(
        {
          tenantId: nvrProps.tenantId,
          type: SystemLogTypes.ERROR,
          messageProps: {
            key: LanguageKeys.nvr.systemLog.liveSignalFailed,
            params: [nvrProps.name],
          },
          section: SystemLogSections.VIDEO_DEVICES_CONFIG,
          entityId: nvrProps.id,
        },
        SystemLogWebSocketTypes.CONFIG,
        { configType: NvrSystemLogDataTypes.LIVE_SIGNAL, msgId: '' },
      );
    await this.nvrLiveSignalService.toDisconnected(entity);
  }

  private async cloudIsRecovered(entity: NvrEntity) {
    const nvrProps = entity.getProps();
    await this.systemLogService.createAndSend(
      {
        tenantId: nvrProps.tenantId,
        type: SystemLogTypes.INFORMATION,
        messageProps: {
          key: LanguageKeys.nvr.systemLog.recoverySucceeded,
          params: [nvrProps.name],
        },
        section: SystemLogSections.VIDEO_DEVICES_LIVE_SIGNAL,
        entityId: nvrProps.id,
      },
      SystemLogWebSocketTypes.CONFIG,
      { configType: NvrSystemLogDataTypes.CLOUD_RECOVERY, msgId: '' },
    );
    await this.serviceProvider.commandBus.execute(
      new UpdateNvrCommand({
        id: nvrProps.id,
        tenantId: nvrProps.tenantId,
        cloudIsRecovering: false,
      }),
    );
  }

  private async handleFogSystemLog(
    entity: NvrEntity,
    metadata: ConfigTypeMsgIdDto,
    fogSystemLog: {
      systemLogProps: SystemLogProps;
      nvrHardwareConfigType?: string;
    },
  ) {
    const { systemLogProps, nvrHardwareConfigType } = fogSystemLog;
    await this.systemLogService.createAndSend(
      { ...systemLogProps, tenantId: entity.getProps().tenantId },
      SystemLogWebSocketTypes.CONFIG,
      { cmdKey: nvrHardwareConfigType, ...metadata },
    );
  }
}
