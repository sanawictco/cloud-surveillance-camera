import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { SystemLogApiService } from 'src/modules/systemLogs/applicationService/apiForAnotherServices/systemLogApi.service';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';
import { CameraActorLogService } from '../../services/actorLogs/cameraActorLog.service';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';

export class HardDeleteCameraCommand extends Command {
  readonly tenantId: string;

  constructor(props: CommandProps<HardDeleteCameraCommand> & IdType) {
    super(props);
    this.tenantId = props.tenantId;
  }
}

@CommandHandler(HardDeleteCameraCommand)
export class HardDeleteCameraCommandHandler implements ICommandHandler<HardDeleteCameraCommand> {
  constructor(
    @Inject(CAMERA_REPOSITORY)
    private readonly cameraRepo: CameraRepository,
    private readonly systemLogApiService: SystemLogApiService,
    private readonly cameraActorLogService: CameraActorLogService,
  ) {}

  async execute(command: HardDeleteCameraCommand): Promise<AggregateID> {
    const cameraEntity: CameraEntity | undefined =
      await this.cameraRepo.findById(command.id);
    if (!cameraEntity) throw new Error('no camera exist with this id');
    if (cameraEntity.getProps().tenantId !== command.tenantId) {
      throw new Error('no camera exist with this id');
    }
    cameraEntity.hardDelete();
    await this.cameraRepo.delete(cameraEntity);
    await this._processDependencies(cameraEntity);
    return command.id;
  }

  private async _processDependencies(cameraEntity: CameraEntity) {
    await this.systemLogApiService.deleteSystemLogs(
      cameraEntity.getProps().tenantId,
      cameraEntity.id,
    );
    await this.cameraActorLogService.hardDelete({
      cameraEntity,
    });
  }
}
