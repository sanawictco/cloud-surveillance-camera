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
import { VideoDeviceConfigQueueService } from '../queues/videoDeviceConfig/videoDeviceQueue.service';
import { VideoDeviceDataQueueService } from '../queues/videoDeviceData/videoDeviceDataQueue.service';
import { UnsetCameraRunningConfigCommand } from '../../commands/camera/unsetCameraRunningConfig.command';

@Injectable()
export class CameraRunningConfigAndCommandService {
  constructor(
    @Inject(forwardRef(() => VideoDeviceConfigQueueService))
    private readonly videoDeviceConfigQueueService: VideoDeviceConfigQueueService,
    @Inject(forwardRef(() => VideoDeviceDataQueueService))
    private readonly videoDeviceDataQueueService: VideoDeviceDataQueueService,
    private readonly serviceProvider: ServiceProvider,
  ) {}
  async runSoftwareConfigIfNotDuplicated(
    nvrEntity: NvrEntity,
    cameraEntity: CameraEntity,
    softwareConfig: CameraSoftwareConfigs,
    data?: Record<string, unknown>,
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
      const msgId = await this.videoDeviceConfigQueueService.addRepeatableMsg(
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
    cameraEntity.assertTenantMatches(nvrEntity);
    if (await this.isConfigRunning(cameraEntity, hardwareCommand)) {
      if (RequestContextService.getContext())
        throw new BadRequestException(
          this.serviceProvider.translatorService.translateByName(
            LanguageKeys.others.errorResponse.badRequest.configIsRunning,
          ),
        );
      return '';
    } else {
      const msgId = await this.videoDeviceDataQueueService.addRepeatableMsg(
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
    msgId?: string,
  ): Promise<boolean> {
    if (configType !== 'all') {
      if (!msgId) return false;
      return this.serviceProvider.commandBus.execute(
        new UnsetCameraRunningConfigCommand(
          cameraEntity.id,
          configType.replace('_receive', '_send'),
          msgId,
        ),
      );
    }
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
    return true;
  }

  async stopAndRemoveAllRunningConfigs(
    cameraEntity: CameraEntity,
    existingRunningConfigs?: Record<string, string>,
  ): Promise<void> {
    if (!existingRunningConfigs) {
      cameraEntity = await this.serviceProvider.queryBus.execute(
        new FindCameraByIdQuery(cameraEntity.id),
      );
    }
    const runningConfigs =
      existingRunningConfigs ?? cameraEntity.getProps().runningConfigs;
    for (const msgId of Object.values(runningConfigs)) {
      if (msgId) {
        await this.videoDeviceConfigQueueService.getAndDeleteRepeatableMsg(
          msgId,
        );
        await this.videoDeviceDataQueueService.getAndDeleteRepeatableMsg(msgId);
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
