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

import { UpdateNvrCommand } from '../../commands/nvr/updateNvr.command';
import { FindNvrByIdQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { VideoDeviceConfigQueueService } from '../queues/videoDeviceConfig/videoDeviceQueue.service';
import { VideoDeviceDataQueueService } from '../queues/videoDeviceData/videoDeviceDataQueue.service';
import {
  NonLockedNvrConfingsOrCommands,
  NvrConfigs,
} from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';

@Injectable()
export class NvrRunningConfigService {
  constructor(
    @Inject(forwardRef(() => VideoDeviceConfigQueueService))
    private readonly videoDeviceConfigQueueService: VideoDeviceConfigQueueService,
    @Inject(forwardRef(() => VideoDeviceDataQueueService))
    private readonly videoDeviceDataQueueService: VideoDeviceDataQueueService,
    private readonly serviceProvider: ServiceProvider,
  ) {}

  async runConfigIfNotDuplicated(
    nvrEntity: NvrEntity,
    nvrConfig: NvrConfigs,
    data?: any,
  ): Promise<string> {
    if (await this._isConfigRunning(nvrEntity, nvrConfig)) {
      if (RequestContextService.getContext()) {
        throw new BadRequestException(
          this.serviceProvider.translatorService.translateByName(
            LanguageKeys.others.errorResponse.badRequest.configIsRunning,
          ),
        );
      }
      return '';
    } else {
      const msgId = await this.videoDeviceConfigQueueService.addRepeatableMsg(
        nvrEntity.generateFogConfig(nvrConfig, data),
      );
      await this._runAndLockConfig(nvrEntity, nvrConfig, msgId);
      return msgId;
    }
  }

  async doneAndUnLockConfig(
    nvrEntity: NvrEntity,
    configType: string = 'all',
  ): Promise<void> {
    try {
      configType = configType.replace('_receive', '_send');
      nvrEntity = await this.serviceProvider.queryBus.execute(
        new FindNvrByIdQuery(nvrEntity.id),
      );
      let { runningConfigs } = nvrEntity.getProps();
      if (configType === 'all') runningConfigs = RunningConfigs.init().unpack();
      else delete runningConfigs[configType];
      await this.serviceProvider.commandBus.execute(
        new UpdateNvrCommand({
          id: nvrEntity.id,
          runningConfigs,
        }),
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
    await this.serviceProvider.commandBus.execute(
      new UpdateNvrCommand({
        id: nvrEntity.id,
        runningConfigs: RunningConfigs.init().unpack(),
      }),
    );
  }

  private async _isConfigRunning(
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
    await this.doneAndUnLockConfig(nvrEntity, configType);
    return false;
  }

  private async _runAndLockConfig(
    nvrEntity: NvrEntity,
    configType: NvrConfigs,
    msgId: string,
  ): Promise<void> {
    if (NonLockedNvrConfingsOrCommands.includes(configType)) return;
    nvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(nvrEntity.id),
    );
    const { runningConfigs } = nvrEntity.getProps();
    runningConfigs[configType] = msgId;
    await this.serviceProvider.commandBus.execute(
      new UpdateNvrCommand({
        id: nvrEntity.id,
        runningConfigs,
      }),
    );
  }
}
