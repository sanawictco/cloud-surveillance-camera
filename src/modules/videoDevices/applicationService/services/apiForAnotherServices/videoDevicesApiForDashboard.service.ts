import { Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { CameraHardwareSendCommands } from 'src/modules/videoDevices/domain/camera/camera.type';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { FindNvrByIdForTenantQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { FindAllNvrsForTenantQuery } from '../../queries/nvr/findAllNvrs.queryHandler';
import { CameraValidator } from '../validators/camera.validator';
import { NvrValidator } from '../validators/nvr.validator';
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

  async sendMoveData(
    tenantId: string,
    id: string,
    data: number[],
  ): Promise<string> {
    const cameraEntity: CameraEntity =
      await this.cameraValidator.checkExistsCameraWihtId(id, tenantId);
    await this.cameraValidator.checkCameraShouldBeActiveAndHasConnectedStatus(
      cameraEntity,
    );
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdForTenantQuery(tenantId, cameraEntity.getProps().nvrId),
    );
    cameraEntity.assertTenantMatches(nvrEntity);
    return await this.cameraRunningConfigAndCommandService.runHardwareCommandIfNotDuplicated(
      nvrEntity,
      cameraEntity,
      CameraHardwareSendCommands.MOVE,
      data,
    );
  }

  async sendZoomData(
    tenantId: string,
    id: string,
    data: number[],
  ): Promise<string> {
    const cameraEntity: CameraEntity =
      await this.cameraValidator.checkExistsCameraWihtId(id, tenantId);
    await this.cameraValidator.checkCameraShouldBeActiveAndHasConnectedStatus(
      cameraEntity,
    );
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdForTenantQuery(tenantId, cameraEntity.getProps().nvrId),
    );
    cameraEntity.assertTenantMatches(nvrEntity);
    return await this.cameraRunningConfigAndCommandService.runHardwareCommandIfNotDuplicated(
      nvrEntity,
      cameraEntity,
      CameraHardwareSendCommands.ZOOM,
      data,
    );
  }

  async checkNvrIsExistsAndActiveAndConnected(
    nvrId: string,
    tenantId: string,
  ): Promise<NvrEntity> {
    const nvrEntity: NvrEntity = await this.nvrValidator.checkExistsNvrWithId(
      nvrId,
      tenantId,
    );
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    return nvrEntity;
  }

  async findNvrIdsForTenant(tenantId: string): Promise<string[]> {
    const nvrs: NvrEntity[] = await this.serviceProvider.queryBus.execute(
      new FindAllNvrsForTenantQuery(tenantId),
    );
    return nvrs.map((nvr) => nvr.id);
  }
}
