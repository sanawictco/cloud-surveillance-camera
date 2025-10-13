import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';

import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { FindNvrByIdQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { UpdateNvrCommand } from '../../commands/nvr/updateNvr.command';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { NvrConfigs } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { VideoDeviceConfigQueueService } from '../queues/videoDeviceConfig/videoDeviceQueue.service';

@Injectable()
export class NvrRunningConfigService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    @Inject(forwardRef(() => VideoDeviceConfigQueueService))
    private readonly videoDeviceConfigQueueService: VideoDeviceConfigQueueService,
  ) {}

  async runConfigIfNotDuplicated(
    nvrEntity: NvrEntity,
    configType: NvrConfigs,
    data?,
  ): Promise<string> {
    if (await this.isConfigRunning(nvrEntity, configType)) {
      if (RequestContextService.getContext())
        throw new BadRequestException(
          this.serviceProvider.translatorService.translateByName(
            LanguageKeys.others.errorResponse.badRequest.configIsRunning,
            this.serviceProvider.userInfoService.getProps().lang,
          ),
        );
      return '';
    } else {
      const msgId = await this.videoDeviceConfigQueueService.addRepeatableMsg(
        nvrEntity.generateFogConfig(configType, data),
      );

      await this.runAndLockConfig(nvrEntity, configType, msgId);
      return msgId;
    }
  }

  async doneAndUnLockConfig(
    nvrEntity: NvrEntity,
    configType: string = 'all',
  ): Promise<void> {
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
  }

  async stopAndRemoveAllRunningConfigs(nvrEntity: NvrEntity) {
    const { id } = nvrEntity.getProps();
    nvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(id),
    );
    const { runningConfigs } = nvrEntity.getProps();
    for (const msgId of Object.values(runningConfigs)) {
      if (msgId) {
        await this.videoDeviceConfigQueueService.getAndDeleteRepeatableMsg(
          msgId,
        );
      }
    }
    await this.serviceProvider.commandBus.execute(
      new UpdateNvrCommand({
        id,
        runningConfigs: RunningConfigs.init().unpack(),
      }),
    );
  }

  private async isConfigRunning(
    nvrEntity: NvrEntity,
    configType: string,
  ): Promise<boolean> {
    nvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(nvrEntity.id),
    );
    const { runningConfigs } = nvrEntity.getProps();
    if (runningConfigs[configType]) return true;
    return false;
  }

  private async runAndLockConfig(
    nvrEntity: NvrEntity,
    configType: NvrConfigs,
    msgId: string,
  ): Promise<void> {
    console.log(')))))))) lock nvr => ', configType);
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
