import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { CameraActorLogService } from '../../services/actorLogs/cameraActorLog.service';
import { CameraEntity } from '../../../domain/camera/camera.entity';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';
import { CameraRunningConfigAndCommandService } from '../../services/runningConfigs/cameraRunningConfigAndCommand.service';

export class InActiveCameraCommand extends Command {
  /** Verified owning tenant; when present the handler fails closed on a foreign camera. */
  readonly tenantId?: string;

  constructor(props: CommandProps<InActiveCameraCommand>) {
    super(props);
    this.tenantId = props.tenantId;
  }
}

@CommandHandler(InActiveCameraCommand)
export class InActiveCameraCommandHandler
  implements ICommandHandler<InActiveCameraCommand>
{
  constructor(
    @Inject(CAMERA_REPOSITORY)
    private readonly cameraRepo: CameraRepository,
    private readonly cameraRunningConfigAndCommandService: CameraRunningConfigAndCommandService,
    private readonly cameraActorLogService: CameraActorLogService,
  ) {}

  async execute(command: InActiveCameraCommand): Promise<AggregateID> {
    const cameraEntity: CameraEntity | undefined =
      await this.cameraRepo.findById(command.id);
    if (!cameraEntity) throw new Error('no camera exist with this id');
    if (
      command.tenantId &&
      cameraEntity.getProps().tenantId !== command.tenantId
    ) {
      throw new Error('no camera exist with this id');
    }
    cameraEntity.inactive();
    await this.cameraRepo.update(cameraEntity);
    const actorId = command.actorProps?.actorId;
    await this.processDependencies(cameraEntity, actorId);
    return command.id;
  }

  private async processDependencies(
    cameraEntity: CameraEntity,
    actorId?: string,
  ) {
    await this.cameraRunningConfigAndCommandService.stopAndRemoveAllRunningConfigs(
      cameraEntity,
    );
    await this.cameraActorLogService.inactive({
      cameraEntity,
      actorId,
    });
  }
}
