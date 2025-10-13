import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';

import { ActorLogTypes } from 'src/modules/shared/dtos/actor.dto';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import {
  CameraSoftwareConfigs,
  CameraHardwareSendCommands,
} from 'src/modules/videoDevices/domain/camera/camera.type';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { UpdateCameraCommand } from '../../commands/camera/updateCamera.command';
import { FindCameraByIdQuery } from '../../queries/camera/findCameraById.queryHandler';
import { CameraConfigQueueService } from '../queues/cameraConfig/cameraConfigQueue.service';
import { CameraDataQueueService } from '../queues/cameraData/cameraDataQueue.service';

@Injectable()
export class CameraRunningConfigAndCommandService {
  constructor(
    @Inject(forwardRef(() => CameraConfigQueueService))
    private readonly cameraConfigQueueService: CameraConfigQueueService,
    @Inject(forwardRef(() => CameraDataQueueService))
    private readonly cameraDataQueueService: CameraDataQueueService,
    private readonly serviceProvider: ServiceProvider,
  ) {}
  async runSoftwareConfigIfNotDuplicated(
    nvrEntity: NvrEntity,
    cameraEntity: CameraEntity,
    softwareConfig: CameraSoftwareConfigs,
    data?,
  ): Promise<string> {
    if (await this.isConfigRunning(cameraEntity, softwareConfig)) {
      if (RequestContextService.getContext())
        throw new BadRequestException(
          this.serviceProvider.translatorService.translateByName(
            LanguageKeys.others.errorResponse.badRequest.configIsRunning,
          ),
        );
      return '';
    } else {
      const msgId = await this.cameraConfigQueueService.addRepeatableMsg(
        cameraEntity.generateFogSoftwareConfig(nvrEntity, softwareConfig, data),
      );
      await this.runAndLockConfig(cameraEntity, softwareConfig, msgId);
      return msgId;
    }
  }
  async runHardwareCommandIfNotDuplicated(
    nvrEntity: NvrEntity,
    cameraEntity: CameraEntity,
    hardwareCommand: CameraHardwareSendCommands,
    data: number[],
    optionalProps?: { actorType: ActorLogTypes; actorId: string },
  ): Promise<string> {
    if (await this.isConfigRunning(cameraEntity, hardwareCommand)) {
      if (RequestContextService.getContext())
        throw new BadRequestException(
          this.serviceProvider.translatorService.translateByName(
            LanguageKeys.others.errorResponse.badRequest.configIsRunning,
          ),
        );
      return '';
    } else {
      const msgId = await this.cameraDataQueueService.addRepeatableMsg(
        cameraEntity.generateFogHardwareCommand(
          hardwareCommand,
          data,
          optionalProps,
        ),
      );
      await this.runAndLockConfig(cameraEntity, hardwareCommand, msgId);
      return msgId;
    }
  }

  async doneAndUnLockConfig(
    cameraEntity: CameraEntity,
    configType: string = 'all',
  ): Promise<void> {
    configType = configType.replace('_receive', '_send');
    cameraEntity = await this.serviceProvider.queryBus.execute(
      new FindCameraByIdQuery(cameraEntity.id),
    );
    let { runningConfigs } = cameraEntity.getProps();
    if (configType === 'all') runningConfigs = RunningConfigs.init().unpack();
    else delete runningConfigs[configType];
    await this.serviceProvider.commandBus.execute(
      new UpdateCameraCommand({
        id: cameraEntity.id,
        runningConfigs,
      }),
    );
  }

  async stopAndRemoveAllRunningConfigs(
    cameraEntity: CameraEntity,
  ): Promise<void> {
    cameraEntity = await this.serviceProvider.queryBus.execute(
      new FindCameraByIdQuery(cameraEntity.id),
    );
    const { runningConfigs } = cameraEntity.getProps();
    for (const msgId of Object.values(runningConfigs)) {
      if (msgId) {
        await this.cameraConfigQueueService.getAndDeleteRepeatableMsg(msgId);
        await this.cameraDataQueueService.getAndDeleteRepeatableMsg(msgId);
      }
    }
    await this.serviceProvider.commandBus.execute(
      new UpdateCameraCommand({
        id: cameraEntity.id,
        runningConfigs: RunningConfigs.init().unpack(),
      }),
    );
  }

  private async isConfigRunning(
    cameraEntity: CameraEntity,
    configType: string,
  ): Promise<boolean> {
    cameraEntity = await this.serviceProvider.queryBus.execute(
      new FindCameraByIdQuery(cameraEntity.id),
    );
    const { runningConfigs } = cameraEntity.getProps();
    if (runningConfigs[configType]) return true;
    return false;
  }

  private async runAndLockConfig(
    cameraEntity: CameraEntity,
    configType: CameraSoftwareConfigs | CameraHardwareSendCommands,
    msgId: string,
  ): Promise<void> {
    console.log(')))))))) lock camera => ', configType);
    cameraEntity = await this.serviceProvider.queryBus.execute(
      new FindCameraByIdQuery(cameraEntity.id),
    );
    const { runningConfigs } = cameraEntity.getProps();
    runningConfigs[configType] = msgId;
    await this.serviceProvider.commandBus.execute(
      new UpdateCameraCommand({
        id: cameraEntity.id,
        runningConfigs,
      }),
    );
  }
}
