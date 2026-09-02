import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { NvrEntity } from '../../../domain/nvr/nvr.entity';

import { FindNvrByIdForTenantQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { VideoDeviceConfigQueueService } from '../queues/videoDeviceConfig/videoDeviceQueue.service';
import { VideoDeviceDataQueueService } from '../queues/videoDeviceData/videoDeviceDataQueue.service';
import { NvrConfigs } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { MutateNvrRunningConfigCommand } from '../../commands/nvr/mutateNvrRunningConfig.command';
import { isValidDeviceMsgId } from 'src/dddLib/utils/deviceMessageId';

type ProvisioningConfig = NvrConfigs.SEARCH | NvrConfigs.REGISTER;
const PROVISIONING_CONFIGS: readonly ProvisioningConfig[] = [
  NvrConfigs.SEARCH,
  NvrConfigs.REGISTER,
];

@Injectable()
export class NvrRunningConfigService {
  constructor(
    @Inject(forwardRef(() => VideoDeviceConfigQueueService))
    private readonly videoDeviceConfigQueueService: VideoDeviceConfigQueueService,
    @Inject(forwardRef(() => VideoDeviceDataQueueService))
    private readonly videoDeviceDataQueueService: VideoDeviceDataQueueService,
    private readonly serviceProvider: ServiceProvider,
    private readonly commandBus: CommandBus,
  ) {}

  async runConfigIfNotDuplicated(
    nvrEntity: NvrEntity,
    nvrConfig: NvrConfigs,
    data?: any,
    msgId?: string,
  ): Promise<string> {
    if (this.isProvisioningConfig(nvrConfig)) {
      return this.runProvisioningConfig(nvrEntity, nvrConfig, data, msgId);
    }
    if (await this.isConfigRunning(nvrEntity, nvrConfig)) {
      if (RequestContextService.getContext()) {
        throw new BadRequestException(
          this.serviceProvider.translatorService.translateByName(
            LanguageKeys.others.errorResponse.badRequest.configIsRunning,
          ),
        );
      }
      return '';
    }
    const config = nvrEntity.generateFogConfig(nvrConfig, data, msgId);
    try {
      const queuedMsgId =
        await this.videoDeviceConfigQueueService.addRepeatableMsg(config);
      await this.mutateRunningConfig(
        nvrEntity.id,
        nvrEntity.getProps().tenantId,
        {
          operation: 'set',
          configType: nvrConfig,
          msgId: queuedMsgId,
        },
      );
      return queuedMsgId;
    } catch (error) {
      await this.videoDeviceConfigQueueService.getAndDeleteRepeatableMsg(
        nvrEntity.getProps().tenantId,
        nvrEntity.id,
        config.msgId,
      );
      throw error;
    }
  }

  async doneAndUnlockConfig(
    nvrEntity: NvrEntity,
    configType: string = 'all',
    msgId?: string,
  ): Promise<boolean> {
    try {
      if (configType === 'all') {
        return this.mutateRunningConfig(
          nvrEntity.id,
          nvrEntity.getProps().tenantId,
          { operation: 'reset' },
        );
      }
      if (!msgId) return false;
      return this.mutateRunningConfig(
        nvrEntity.id,
        nvrEntity.getProps().tenantId,
        {
          operation: 'unsetIfMatches',
          configType,
          msgId,
        },
      );
    } catch (err) {
      this.serviceProvider.logger.error(
        `NvrRunningConfig: failed to unlock configType=${configType} for nvrId=${nvrEntity.id}`,
        (err as Error)?.stack,
      );
      throw err;
    }
  }

  async stopAndRemoveAllRunningConfigs(nvrEntity: NvrEntity): Promise<void> {
    const refreshed: NvrEntity | undefined =
      await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(
          nvrEntity.getProps().tenantId,
          nvrEntity.id,
        ),
      );
    // The NVR can be deleted between the caller's read and this re-fetch;
    // there is then nothing left to stop.
    if (!refreshed) return;
    nvrEntity = refreshed;
    const { runningConfigs } = nvrEntity.getProps();
    for (const msgId of Object.values(runningConfigs)) {
      if (isValidDeviceMsgId(msgId)) {
        await this.videoDeviceConfigQueueService.getAndDeleteRepeatableMsg(
          nvrEntity.getProps().tenantId,
          nvrEntity.id,
          msgId,
        );
        await this.videoDeviceDataQueueService.getAndDeleteRepeatableMsg(
          nvrEntity.getProps().tenantId,
          nvrEntity.id,
          msgId,
        );
      }
    }
    await this.mutateRunningConfig(
      nvrEntity.id,
      nvrEntity.getProps().tenantId,
      { operation: 'reset' },
    );
  }

  private async isConfigRunning(
    nvrEntity: NvrEntity,
    configType: string,
  ): Promise<boolean> {
    const refreshed: NvrEntity | undefined =
      await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(
          nvrEntity.getProps().tenantId,
          nvrEntity.id,
        ),
      );
    // A deleted NVR has no running config.
    if (!refreshed) return false;
    nvrEntity = refreshed;
    const { runningConfigs } = nvrEntity.getProps();
    const msgId = runningConfigs[configType];
    if (!msgId) return false;
    if (!isValidDeviceMsgId(msgId)) {
      await this.mutateRunningConfig(
        nvrEntity.id,
        nvrEntity.getProps().tenantId,
        {
          operation: 'unsetIfMatches',
          configType,
          msgId,
        },
      );
      return false;
    }
    const tenantId = nvrEntity.getProps().tenantId;
    const configExistsInQueue =
      (await this.videoDeviceConfigQueueService.getRepeatableMsg(
        tenantId,
        nvrEntity.id,
        msgId,
      )) ||
      (await this.videoDeviceDataQueueService.getRepeatableMsg(
        tenantId,
        nvrEntity.id,
        msgId,
      ));
    if (configExistsInQueue) return true;
    this.serviceProvider.logger.warn(
      `NvrRunningConfig: stale lock detected for configType=${configType} nvrId=${nvrEntity.id}, msgId=${msgId} not found in queue. Auto-clearing.`,
    );
    await this.mutateRunningConfig(
      nvrEntity.id,
      nvrEntity.getProps().tenantId,
      {
        operation: 'unsetIfMatches',
        configType,
        msgId,
      },
    );
    return false;
  }

  private async runProvisioningConfig(
    nvrEntity: NvrEntity,
    configType: ProvisioningConfig,
    data?: unknown,
    msgId?: string,
  ): Promise<string> {
    const config = nvrEntity.generateFogConfig(configType, data, msgId);
    const queuedMsgId =
      await this.videoDeviceConfigQueueService.reserveMsgId(config);
    let claimed: boolean;
    try {
      claimed = await this.mutateRunningConfig(
        nvrEntity.id,
        nvrEntity.getProps().tenantId,
        {
          operation: 'claimProvisioning',
          configType,
          msgId: queuedMsgId,
        },
      );
      if (
        !claimed &&
        (await this.clearStaleProvisioningConfig(
          nvrEntity.getProps().tenantId,
          nvrEntity.id,
        ))
      ) {
        claimed = await this.mutateRunningConfig(
          nvrEntity.id,
          nvrEntity.getProps().tenantId,
          {
            operation: 'claimProvisioning',
            configType,
            msgId: queuedMsgId,
          },
        );
      }
    } catch (error) {
      this.videoDeviceConfigQueueService.releaseMsgIdReservation(
        nvrEntity.getProps().tenantId,
        nvrEntity.id,
        queuedMsgId,
      );
      throw error;
    }
    if (!claimed) {
      this.videoDeviceConfigQueueService.releaseMsgIdReservation(
        nvrEntity.getProps().tenantId,
        nvrEntity.id,
        queuedMsgId,
      );
      return this.rejectRunningConfig();
    }
    try {
      return await this.videoDeviceConfigQueueService.addReservedRepeatableMsg(
        config,
      );
    } catch (error) {
      await this.mutateRunningConfig(
        nvrEntity.id,
        nvrEntity.getProps().tenantId,
        {
          operation: 'unsetIfMatches',
          configType,
          msgId: queuedMsgId,
        },
      );
      throw error;
    }
  }

  private async clearStaleProvisioningConfig(
    tenantId: string,
    nvrId: string,
  ): Promise<boolean> {
    const nvrEntity: NvrEntity | undefined =
      await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(tenantId, nvrId),
      );
    if (!nvrEntity) return false;
    const runningConfigs = nvrEntity.getProps().runningConfigs;
    const active = PROVISIONING_CONFIGS.map((configType) => ({
      configType,
      msgId: runningConfigs[configType],
    })).find(({ msgId }) => msgId);
    if (!active?.msgId) return false;
    if (
      isValidDeviceMsgId(active.msgId) &&
      (await this.videoDeviceConfigQueueService.getRepeatableMsg(
        nvrEntity.getProps().tenantId,
        nvrEntity.id,
        active.msgId,
      ))
    ) {
      return false;
    }
    return this.mutateRunningConfig(nvrId, tenantId, {
      operation: 'unsetIfMatches',
      configType: active.configType,
      msgId: active.msgId,
    });
  }

  private mutateRunningConfig(
    nvrId: string,
    tenantId: string,
    mutation: ConstructorParameters<typeof MutateNvrRunningConfigCommand>[1],
  ): Promise<boolean> {
    return this.commandBus.execute(
      new MutateNvrRunningConfigCommand(nvrId, mutation, tenantId),
    );
  }

  private rejectRunningConfig(): never {
    if (RequestContextService.getContext()) {
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.others.errorResponse.badRequest.configIsRunning,
        ),
      );
    }
    throw new BadRequestException('NVR provisioning operation is running');
  }

  private isProvisioningConfig(
    configType: NvrConfigs,
  ): configType is ProvisioningConfig {
    return PROVISIONING_CONFIGS.includes(configType as ProvisioningConfig);
  }
}
