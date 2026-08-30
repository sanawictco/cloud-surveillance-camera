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
import { FindNvrByIdForTenantQuery } from 'src/modules/videoDevices/applicationService/queries/nvr/findNvrById.queryHandler';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';
import { CameraEntity } from '../../../domain/camera/camera.entity';
import { CameraActorLogService } from '../../services/actorLogs/cameraActorLog.service';
import { CameraRunningConfigAndCommandService } from '../../services/runningConfigs/cameraRunningConfigAndCommand.service';

export class SoftDeleteCameraCommand extends Command {
  /** Verified owning tenant; when present the handler fails closed on a foreign camera. */
  readonly tenantId?: string;

  constructor(props: CommandProps<SoftDeleteCameraCommand> & IdType) {
    super(props);
    this.tenantId = props.tenantId;
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
    if (
      command.tenantId &&
      cameraEntity.getProps().tenantId !== command.tenantId
    ) {
      throw new Error('no camera exist with this id');
    }
    const nvrEntity: NvrEntity | undefined =
      await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(
          cameraEntity.getProps().tenantId,
          cameraEntity.getProps().nvrId,
        ),
      );
    if (!nvrEntity) throw new Error('no camera exist with this id');
    cameraEntity.assertTenantMatches(nvrEntity);
    const { runningConfigs } = cameraEntity.getProps();
    cameraEntity.softDelete();
    await this.cameraRepo.update(cameraEntity);
    const actorId = command.actorProps?.actorId;
    await this.processDependencies(cameraEntity, runningConfigs, actorId);
    return command.id;
  }

  private async processDependencies(
    cameraEntity: CameraEntity,
    runningConfigs: Record<string, string>,
    actorId?: string,
  ) {
    const { id } = cameraEntity.getProps();
    await this.dashboardApiForVideoDevicesService.deleteCameraEffectFromWidgets(
      cameraEntity.getProps().tenantId,
      cameraEntity.getProps().nvrId,
      id,
    );
    await this.cameraRunningConfigAndCommandService.stopAndRemoveAllRunningConfigs(
      cameraEntity,
      runningConfigs,
    );
    await this.cameraActorLogService.delete({
      cameraEntity,
      actorId,
    });
  }
}
