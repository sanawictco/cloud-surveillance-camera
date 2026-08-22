import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { NvrEntity } from '../../../domain/nvr/nvr.entity';

import { FindNvrByIdQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { VideoDeviceConfigQueueService } from '../queues/videoDeviceConfig/videoDeviceQueue.service';
import { VideoDeviceDataQueueService } from '../queues/videoDeviceData/videoDeviceDataQueue.service';
import { NvrConfigs } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';

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
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepository: NvrRepository,
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
      await this.nvrRepository.setRunningConfig(
        nvrEntity.id,
        nvrConfig,
        queuedMsgId,
      );
      return queuedMsgId;
    } catch (error) {
      await this.videoDeviceConfigQueueService.getAndDeleteRepeatableMsg(
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
        return this.nvrRepository.resetRunningConfigs(nvrEntity.id);
      }
      if (!msgId) return false;
      return this.nvrRepository.compareAndSetRunningConfig(
        nvrEntity.id,
        configType,
        msgId,
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
    nvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(nvrEntity.id),
    );
    const { runningConfigs } = nvrEntity.getProps();
    for (const msgId of Object.values(runningConfigs)) {
      if (msgId) {
        await this.videoDeviceConfigQueueService.getAndDeleteRepeatableMsg(
          msgId,
        );
        await this.videoDeviceDataQueueService.getAndDeleteRepeatableMsg(msgId);
      }
    }
    await this.nvrRepository.resetRunningConfigs(nvrEntity.id);
  }

  private async isConfigRunning(
    nvrEntity: NvrEntity,
    configType: string,
  ): Promise<boolean> {
    nvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(nvrEntity.id),
    );
    const { runningConfigs } = nvrEntity.getProps();
    const msgId = runningConfigs[configType];
    if (!msgId) return false;
    const configExistsInQueue =
      (await this.videoDeviceConfigQueueService.getRepeatableMsg(msgId)) ||
      (await this.videoDeviceDataQueueService.getRepeatableMsg(msgId));
    if (configExistsInQueue) return true;
    this.serviceProvider.logger.warn(
      `NvrRunningConfig: stale lock detected for configType=${configType} nvrId=${nvrEntity.id}, msgId=${msgId} not found in queue. Auto-clearing.`,
    );
    await this.nvrRepository.compareAndSetRunningConfig(
      nvrEntity.id,
      configType,
      msgId,
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
    const claimed = await this.nvrRepository.claimProvisioningConfig(
      nvrEntity.id,
      configType,
      config.msgId,
    );
    if (!claimed) return this.rejectRunningConfig();

    try {
      return await this.videoDeviceConfigQueueService.addRepeatableMsg(config);
    } catch (error) {
      await this.nvrRepository.compareAndSetRunningConfig(
        nvrEntity.id,
        configType,
        config.msgId,
      );
      throw error;
    }
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
