import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';

import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { DashboardApiForVideoDevicesService } from 'src/modules/dashboard/applicationService/apiForAnotherServices/dashboardApiForDevices.service';
import { FindNvrByIdQuery } from 'src/modules/videoDevices/applicationService/queries/nvr/findNvrById.queryHandler';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';
import { CameraEntity } from '../../../domain/camera/camera.entity';
import { CameraActorLogService } from '../../services/actorLogs/cameraActorLog.service';
import { CameraRunningConfigAndCommandService } from '../../services/runningConfigs/cameraRunningConfigAndCommand.service';

export class SoftDeleteCameraCommand extends Command {
  constructor(props: CommandProps<SoftDeleteCameraCommand> & IdType) {
    super(props);
  }
}

@CommandHandler(SoftDeleteCameraCommand)
export class SoftDeleteCameraCommandHandler implements ICommandHandler<SoftDeleteCameraCommand> {
  constructor(
    @Inject(CAMERA_REPOSITORY)
    private readonly cameraRepo: CameraRepository,
    private readonly dashboardApiForVideoDevicesService: DashboardApiForVideoDevicesService,
    private readonly cameraRunningConfigAndCommandService: CameraRunningConfigAndCommandService,
    private readonly cameraActorLogService: CameraActorLogService,
    private readonly serviceProvider: ServiceProvider,
  ) {}

  async execute(command: SoftDeleteCameraCommand): Promise<AggregateID> {
    const cameraEntity: CameraEntity | undefined =
      await this.cameraRepo.findById(command.id);
    if (!cameraEntity) throw new Error('no camera exist with this id');
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(cameraEntity.getProps().nvrId),
    );
    cameraEntity.assertTenantMatches(nvrEntity);
    cameraEntity.delete();
    await this.cameraRepo.delete(cameraEntity);
    const actorId = command.actorProps?.actorId;
    await this.processDependencies(cameraEntity, actorId);
    return command.id;
  }

  private async processDependencies(
    cameraEntity: CameraEntity,
    actorId?: string,
  ) {
    const { id } = cameraEntity.getProps();
    await this.dashboardApiForVideoDevicesService.deleteCameraEffectFromWidgets(
      id,
    );
    await this.cameraRunningConfigAndCommandService.stopAndRemoveAllRunningConfigs(
      cameraEntity,
    );
    await this.cameraActorLogService.delete({
      cameraEntity,
      actorId,
    });
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(cameraEntity.getProps().nvrId),
    );
    cameraEntity.assertTenantMatches(nvrEntity);
  }
}
