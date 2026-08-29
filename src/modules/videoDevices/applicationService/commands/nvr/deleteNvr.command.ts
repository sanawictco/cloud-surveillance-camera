import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { MqttApiService } from 'src/extensions/mqtt/mqttApi.service';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';
import { SanawApiVideoDeviceService } from 'src/extensions/sanawApi/services/sanawApiVideoDevice.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { SystemLogService } from 'src/modules/systemLogs/applicationService/services/systemLog.service';
import { NvrActorLogService } from '../../services/actorLogs/nvrActorLog.service';
import { NvrLiveSignalService } from '../../services/liveSignals/nvrLiveSignal.service';
import { NvrRunningConfigService } from '../../services/runningConfigs/nvrRunningConfig.service';
import { FindAllCamerasQuery } from 'src/modules/videoDevices/applicationService/queries/camera/findAllCameras.queryHandler';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { DashboardApiForVideoDevicesService } from 'src/modules/dashboard/applicationService/apiForAnotherServices/dashboardApiForDevices.service';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { SoftDeleteCameraCommand } from '../camera/softDeleteCamera.command';

export class DeleteNvrCommand extends Command {
  readonly tenantId: string;

  constructor(props: CommandProps<DeleteNvrCommand> & IdType) {
    super(props);
    this.tenantId = props.tenantId;
  }
}
@CommandHandler(DeleteNvrCommand)
export class DeleteNvrCommandHandler implements ICommandHandler<DeleteNvrCommand> {
  constructor(
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepo: NvrRepository,
    private readonly nvrRunningConfigService: NvrRunningConfigService,
    private readonly sanawApiVideoDeviceService: SanawApiVideoDeviceService,
    private readonly mqttApiService: MqttApiService,
    private readonly serviceProvider: ServiceProvider,
    private readonly systemLogService: SystemLogService,
    private readonly dashboardApiForVideoDevicesService: DashboardApiForVideoDevicesService,
    private readonly nvrLiveSignalService: NvrLiveSignalService,
    private readonly nvrActorLogService: NvrActorLogService,
  ) {}

  async execute(command: DeleteNvrCommand): Promise<AggregateID> {
    const nvrEntity: NvrEntity | undefined = await this.nvrRepo.findById(
      command.id,
    );
    if (!nvrEntity) throw Error('nvr does not exist');
    if (nvrEntity.getProps().tenantId !== command.tenantId) {
      throw Error('nvr does not exist');
    }
    await this.processPreDependencies(nvrEntity);
    nvrEntity.delete();
    await this.nvrRepo.delete(nvrEntity);
    await this.processPostDependencies(nvrEntity);
    return command.id;
  }

  private async processPreDependencies(nvrEntity: NvrEntity) {
    await this.nvrRunningConfigService.stopAndRemoveAllRunningConfigs(
      nvrEntity,
    );
    await this.sanawApiVideoDeviceService.unUseNvr(
      nvrEntity.getProps().serialNumber,
    );
    // delete nvr systemLogs
    await this.systemLogService.deleteSystemLogs(
      nvrEntity.getProps().tenantId,
      nvrEntity.id,
    );
    // stop nvr liveSignal
    await this.nvrLiveSignalService.stop(nvrEntity);
    // softDelete dependent cameras
    const dependentCameraEntities: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasQuery({
          filter: {
            tenantId: nvrEntity.getProps().tenantId,
            nvrId: nvrEntity.id,
            isDeleted: { $ne: true },
          },
        }),
      );
    for (const dependentCameraEntity of dependentCameraEntities) {
      dependentCameraEntity.assertTenantMatches(nvrEntity);
      await this.serviceProvider.commandBus.execute(
        new SoftDeleteCameraCommand({ id: dependentCameraEntity.id }),
      );
    }
    await this.dashboardApiForVideoDevicesService.deleteDependentPages(
      nvrEntity.getProps().tenantId,
      nvrEntity.id,
    );
    await this.mqttApiService.deleteNvrTopics(
      nvrEntity.getProps().serialNumber,
      nvrEntity.id,
    );
  }
  private async processPostDependencies(nvrEntity: NvrEntity) {
    await this.nvrActorLogService.delete({ nvrEntity });
  }
}
