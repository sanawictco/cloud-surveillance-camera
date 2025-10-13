import { Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { CameraHardwareSendCommands } from 'src/modules/videoDevices/domain/camera/camera.type';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { FindNvrByIdQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { CameraValidator } from '../http/validators/camera.validator';
import { NvrValidator } from '../http/validators/nvr.validator';
import { CameraRunningConfigAndCommandService } from '../runningConfigs/cameraRunningConfigAndCommand.service';
import { VideoDevicesApiBaseService } from './videoDevicesApi.base.service';

@Injectable()
export class VideoDevicesApiForDashboardService extends VideoDevicesApiBaseService {
  constructor(
    protected readonly serviceProvider: ServiceProvider,
    private readonly cameraRunningConfigAndCommandService: CameraRunningConfigAndCommandService,
    protected readonly cameraValidator: CameraValidator,
    protected readonly nvrValidator: NvrValidator,
  ) {
    super(cameraValidator, serviceProvider);
  }

  async sendMoveData(id: string, data: number[]): Promise<string> {
    const cmdStructuresValue = data;
    const cameraEntity: CameraEntity =
      await this.cameraValidator.checkExistsCameraWihtId(id);
    await this.cameraValidator.checkCameraShouldBeActiveAndHasConnectedStatus(
      cameraEntity,
    );
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(cameraEntity.getProps().nvrId),
    );
    return await this.cameraRunningConfigAndCommandService.runHardwareCommandIfNotDuplicated(
      nvrEntity,
      cameraEntity,
      CameraHardwareSendCommands.MOVE,
      [], //TODO
    );
  }

  async sendZoomData(id: string, data: number[]): Promise<string> {
    const cmdStructuresValue = data;
    const cameraEntity: CameraEntity =
      await this.cameraValidator.checkExistsCameraWihtId(id);
    await this.cameraValidator.checkCameraShouldBeActiveAndHasConnectedStatus(
      cameraEntity,
    );
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(cameraEntity.getProps().nvrId),
    );
    return await this.cameraRunningConfigAndCommandService.runHardwareCommandIfNotDuplicated(
      nvrEntity,
      cameraEntity,
      CameraHardwareSendCommands.ZOOM,
      [], //TODO
    );
  }

  async checkNvrIsExistsAndActiveAndConnected(nvrId: string) {
    const nvrEntity: NvrEntity =
      await this.nvrValidator.checkExistsNvrWithId(nvrId);
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
  }
}
