import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { CameraActorLogService } from '../../services/actorLogs/cameraActorLog.service';
import { CameraEntity } from '../../../domain/camera/camera.entity';
import { UpdateCameraProps } from 'src/modules/videoDevices/domain/camera/camera.type';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';
export class UpdateCameraCommand
  extends Command
  implements Partial<UpdateCameraProps>
{
  readonly tenantId?: string;
  readonly name?: string;
  readonly nvrId?: string;
  readonly isDeleted?: boolean;
  readonly liveSignalStatus?: LiveSignalStatuses;
  readonly runningConfigs?: Record<string, string>;

  constructor(props: CommandProps<UpdateCameraCommand> & IdType) {
    super(props);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.nvrId = props.nvrId;
    this.isDeleted = props.isDeleted;
    this.runningConfigs = props.runningConfigs;
  }
}

@CommandHandler(UpdateCameraCommand)
export class UpdateCameraCommandHandler implements ICommandHandler<UpdateCameraCommand> {
  constructor(
    @Inject(CAMERA_REPOSITORY)
    protected readonly cameraRepo: CameraRepository,
    protected readonly cameraActorLogService: CameraActorLogService,
  ) {}

  async execute(command: UpdateCameraCommand): Promise<AggregateID> {
    const cameraEntity: CameraEntity | undefined =
      await this.cameraRepo.findById(command.id);
    const updatedObj = {
      tenantId: command.tenantId,
      name: command.name,
      nvrId: command.nvrId,
      isDeleted: command.isDeleted,
      liveSignalStatus: command.liveSignalStatus,
      runningConfigs: command.runningConfigs,
    };
    if (!cameraEntity) throw new Error('entity not exists');
    const recoveredFromTrash =
      cameraEntity.getProps().isDeleted && command.isDeleted === false;
    cameraEntity.update(updatedObj);
    await this.cameraRepo.update(cameraEntity);
    const actorId = command.actorProps?.actorId;
    await this.processDependencies({
      cameraEntity,
      updatedObj,
      actorId,
      recoveredFromTrash,
    });
    return command.id;
  }

  private async processDependencies(props: {
    cameraEntity: CameraEntity;
    actorId?: string;
    updatedObj: any;
    recoveredFromTrash: boolean;
  }) {
    const { cameraEntity, actorId, updatedObj, recoveredFromTrash } = props;
    const currentOrOldName = cameraEntity.getProps().name;
    if (recoveredFromTrash)
      await this.cameraActorLogService.recoveryFromTrash({
        cameraEntity,
        actorId,
      });
    else if (updatedObj.name)
      await this.cameraActorLogService.update({
        actorId,
        cameraEntity,
        updateCameraProps: {
          currentOrOldName,
          updatedProps: updatedObj,
        },
      });
  }
}
