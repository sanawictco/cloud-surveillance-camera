import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';
import { NvrRunningConfigService } from '../../services/runningConfigs/nvrRunningConfig.service';
import { NvrLiveSignalService } from '../../services/liveSignals/nvrLiveSignal.service';
import { NvrActorLogService } from '../../services/actorLogs/nvrActorLog.service';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindAllCamerasQuery } from 'src/modules/videoDevices/applicationService/queries/camera/findAllCameras.queryHandler';
import { InActiveCameraCommand } from 'src/modules/videoDevices/applicationService/commands/camera/inactiveCamera.command';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';

export class InActiveNvrCommand extends Command {
  constructor(props: CommandProps<InActiveNvrCommand>) {
    super(props);
  }
}

@CommandHandler(InActiveNvrCommand)
export class InActiveNvrCommandHandler implements ICommandHandler<InActiveNvrCommand> {
  constructor(
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepo: NvrRepository,
    private readonly serviceProvider: ServiceProvider,
    private readonly nvrRunningConfigService: NvrRunningConfigService,
    private readonly nvrLiveSignalService: NvrLiveSignalService,
    private readonly nvrActorLogService: NvrActorLogService,
  ) {}

  async execute(command: InActiveNvrCommand): Promise<AggregateID> {
    const nvrEntity: NvrEntity | undefined = await this.nvrRepo.findById(
      command.id,
    );
    if (!nvrEntity) throw Error('not exist nvr with id');
    const actorId = command.actorProps?.actorId;
    if (!actorId) throw new Error('actorId does not exist');
    await this.processPreDependencies(nvrEntity, actorId);
    nvrEntity.inactive();
    await this.nvrRepo.update(nvrEntity);
    await this.processPostDependencies(nvrEntity, actorId);
    return command.id;
  }

  private async processPreDependencies(nvrEntity: NvrEntity, actorId?: string) {
    const dependentCameraEntities: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasQuery({
          filter: {
            tenantId: nvrEntity.getProps().tenantId,
            nvrId: nvrEntity.id,
            isActive: true,
          },
        }),
      );
    for (const dependentCameraEntity of dependentCameraEntities) {
      dependentCameraEntity.assertTenantMatches(nvrEntity);
      await this.serviceProvider.commandBus.execute(
        new InActiveCameraCommand({
          id: dependentCameraEntity.id,
          actorProps: { actorId },
        }),
      );
    }

    await this.nvrLiveSignalService.stop(nvrEntity);
    await this.nvrRunningConfigService.stopAndRemoveAllRunningConfigs(
      nvrEntity,
    );
  }

  private async processPostDependencies(nvrEntity: NvrEntity, actorId: string) {
    await this.nvrActorLogService.inactive({
      nvrEntity,
      actorId,
    });
  }
}
