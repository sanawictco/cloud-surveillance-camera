import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Command } from 'src/dddLib/applicationService/command.base';
import { CAMERA_REPOSITORY } from '../../../infra/camera/camera.diToken';
import { CameraRepository } from '../../../infra/camera/camera.repository';

export class UnsetCameraRunningConfigCommand extends Command {
  constructor(
    id: string,
    public readonly configType: string,
    public readonly msgId: string,
    public readonly tenantId: string,
  ) {
    super({ id });
  }
}

@CommandHandler(UnsetCameraRunningConfigCommand)
export class UnsetCameraRunningConfigCommandHandler implements ICommandHandler<
  UnsetCameraRunningConfigCommand,
  boolean
> {
  constructor(
    @Inject(CAMERA_REPOSITORY)
    private readonly cameraRepository: CameraRepository,
  ) {}

  execute(command: UnsetCameraRunningConfigCommand): Promise<boolean> {
    return this.cameraRepository.unsetRunningConfigIfMatches(
      command.id,
      command.configType,
      command.msgId,
      command.tenantId,
    );
  }
}
