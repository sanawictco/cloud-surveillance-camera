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

export class ActiveCameraCommand extends Command {
  /** Verified owning tenant; when present the handler fails closed on a foreign camera. */
  readonly tenantId?: string;

  constructor(props: CommandProps<ActiveCameraCommand>) {
    super(props);
    this.tenantId = props.tenantId;
  }
}

@CommandHandler(ActiveCameraCommand)
export class ActiveCameraCommandHandler
  implements ICommandHandler<ActiveCameraCommand>
{
  constructor(
    @Inject(CAMERA_REPOSITORY)
    private readonly cameraRepo: CameraRepository,
    private readonly cameraActorLogService: CameraActorLogService,
  ) {}

  async execute(command: ActiveCameraCommand): Promise<AggregateID> {
    const cameraEntity: CameraEntity | undefined =
      await this.cameraRepo.findById(command.id);
    if (!cameraEntity) throw new Error('no camera exist with this id');
    if (
      command.tenantId &&
      cameraEntity.getProps().tenantId !== command.tenantId
    ) {
      throw new Error('no camera exist with this id');
    }
    cameraEntity.active();
    await this.cameraRepo.update(cameraEntity);
    const actorId = command.actorProps?.actorId;
    await this.processDependencies(cameraEntity, actorId);
    return command.id;
  }

  private async processDependencies(
    cameraEntity: CameraEntity,
    actorId?: string,
  ) {
    await this.cameraActorLogService.active({
      cameraEntity,
      actorId,
    });
  }
}
