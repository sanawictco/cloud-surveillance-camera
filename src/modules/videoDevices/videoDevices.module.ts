import { Module, Provider, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { CachingModule } from 'src/extensions/caching/cacheing.module';
import { MqttModule } from 'src/extensions/mqtt/mqtt.module';
import { QueueModule } from 'src/extensions/queue/queue.module';
import { SanawApiModule } from 'src/extensions/sanawApi/sanawApi.module';
import { WsModule } from 'src/extensions/websocket/ws.module';
import { ActorLogModule } from '../actorLogs/actorLog.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { SmsNotifierModule } from '../smsNotifier/smsNotifier.module';
import { SystemLogModule } from '../systemLogs/systemLog.module';
import { ActiveCameraCommandHandler } from './applicationService/commands/camera/activeCamera.command';
import { CreateCameraCommandHandler } from './applicationService/commands/camera/createCamera.command';
import { InActiveCameraCommandHandler } from './applicationService/commands/camera/inactiveCamera.command';
import { RestoreCamerasToCacheCommandHandler } from './applicationService/commands/camera/restoreCamerasToCache.command';
import { SoftDeleteCameraCommandHandler } from './applicationService/commands/camera/softDeleteCamera.command';
import { UpdateCameraCommandHandler } from './applicationService/commands/camera/updateCamera.command';
import { ActiveNvrCommandHandler } from './applicationService/commands/nvr/activeNvr.command';
import { CreateNvrCommandHandler } from './applicationService/commands/nvr/createNvr.command';
import { DeleteNvrCommandHandler } from './applicationService/commands/nvr/deleteNvr.command';
import { InActiveNvrCommandHandler } from './applicationService/commands/nvr/inactiveNvr.command';
import { RestoreNvrsToCacheCommandHandler } from './applicationService/commands/nvr/restoreNvrsToCache.command';
import { UpdateNvrCommandHandler } from './applicationService/commands/nvr/updateNvr.command';
import {
  FindAllCamerasForTenantQueryHandler,
  FindAllCamerasQueryHandler,
} from './applicationService/queries/camera/findAllCameras.queryHandler';
import { FindAllDeletedCamerasByDeletedSerialNumbersQueryHandler } from './applicationService/queries/camera/findAllDeletedCamerasByDeletedSerialNumbers.queryHandler';
import {
  FindCameraByIdForTenantQueryHandler,
  FindCameraByIdQueryHandler,
} from './applicationService/queries/camera/findCameraById.queryHandler';
import {
  FindCameraByNameForTenantQueryHandler,
  FindCameraByNameQueryHandler,
} from './applicationService/queries/camera/findCameraByName.queryHandler';
import { FindCameraByNameAndNvrIdQueryHandler } from './applicationService/queries/camera/findCameraByNameAndNvrId.queryHandler';
import { FindCameraBySerialNumberQueryHandler } from './applicationService/queries/camera/findCameraBySerialNumber.queryHandler';
import {
  FindAllNvrsForTenantQueryHandler,
  FindAllNvrsQueryHandler,
} from './applicationService/queries/nvr/findAllNvrs.queryHandler';
import {
  FindNvrByIdForTenantQueryHandler,
  FindNvrByIdQueryHandler,
} from './applicationService/queries/nvr/findNvrById.queryHandler';
import {
  FindNvrByNameForTenantQueryHandler,
  FindNvrByNameQueryHandler,
} from './applicationService/queries/nvr/findNvrByName.queryHandler';
import { FindNvrBySerialNumberQueryHandler } from './applicationService/queries/nvr/findNvrBySerialNumber.queryHandler';
import { CameraActorLogService } from './applicationService/services/actorLogs/cameraActorLog.service';
import { NvrActorLogService } from './applicationService/services/actorLogs/nvrActorLog.service';
import { VideoDevicesApiForDashboardService } from './applicationService/services/apiForAnotherServices/videoDevicesApiForDashboard.service';
import { VideoDevicesApiForFogCommunicationManagerService } from './applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service';
import { VideoDevicesApiforTrashService } from './applicationService/services/apiForAnotherServices/videoDevicesApiForTrash.service';
import { NvrsHttpService } from './applicationService/services/http/nvr.http.service';
import { VideoDeviceInitService } from './applicationService/services/init.service';
import { CameraLiveSignalService } from './applicationService/services/liveSignals/cameraLiveSignal.service';
import { NvrLiveSignalService } from './applicationService/services/liveSignals/nvrLiveSignal.service';
import { VideoDeviceConfigQueueService } from './applicationService/services/queues/videoDeviceConfig/videoDeviceQueue.service';
import { VideoDeviceDataQueueService } from './applicationService/services/queues/videoDeviceData/videoDeviceDataQueue.service';
import { CameraRunningConfigAndCommandService } from './applicationService/services/runningConfigs/cameraRunningConfigAndCommand.service';
import { NvrRunningConfigService } from './applicationService/services/runningConfigs/nvrRunningConfig.service';
import { CameraSystemLogService } from './applicationService/services/systemLogs/cameraSystemLog.service';
import { NvrSystemLogService } from './applicationService/services/systemLogs/nvrSystemLog.service';
import { CameraValidator } from './applicationService/services/validators/camera.validator';
import { NvrValidator } from './applicationService/services/validators/nvr.validator';
import { FogCommunicationHttpController } from './controllers/fogCommunication.http.controller';
import { NvrHttpController } from './controllers/nvr.http.controller';
import { CAMERA_REPOSITORY } from './infra/camera/camera.diToken';
import { CameraMapper } from './infra/camera/camera.mapper';
import { CameraRepository } from './infra/camera/camera.repository';
import { CameraModel, CameraSchema } from './infra/camera/camera.schema';
import { NVR_REPOSITORY } from './infra/nvr/nvr.diToken';
import { NvrMapper } from './infra/nvr/nvr.mapper';
import { NvrRepository } from './infra/nvr/nvr.repository';
import { NvrModel, NvrSchema } from './infra/nvr/nvr.schema';
import { NvrMqttService } from './applicationService/services/mqtt/nvrMqtt.service';
import { CameraMqttService } from './applicationService/services/mqtt/cameraMqtt.service';
import { VideoDevicesConfigsMqttController } from './controllers/videoDeviceConfigs.mqtt.controller';
import { MutateNvrRunningConfigCommandHandler } from './applicationService/commands/nvr/mutateNvrRunningConfig.command';
import { UnsetCameraRunningConfigCommandHandler } from './applicationService/commands/camera/unsetCameraRunningConfig.command';
import { CamerasHttpController } from './controllers/camera.http.controller';
import { CamerasHttpService } from './applicationService/services/http/camera.http.service';

const commandHandlers: Provider[] = [
  ...[
    CreateNvrCommandHandler,
    UpdateNvrCommandHandler,
    DeleteNvrCommandHandler,
    ActiveNvrCommandHandler,
    InActiveNvrCommandHandler,
    RestoreNvrsToCacheCommandHandler,
    MutateNvrRunningConfigCommandHandler,
  ],
  ...[
    UpdateCameraCommandHandler,
    SoftDeleteCameraCommandHandler,
    CreateCameraCommandHandler,
    ActiveCameraCommandHandler,
    InActiveCameraCommandHandler,
    RestoreCamerasToCacheCommandHandler,
    UnsetCameraRunningConfigCommandHandler,
  ],
];
const queryHandlers: Provider[] = [
  ...[
    FindAllNvrsQueryHandler,
    FindAllNvrsForTenantQueryHandler,
    FindNvrByIdQueryHandler,
    FindNvrByIdForTenantQueryHandler,
    FindNvrByNameQueryHandler,
    FindNvrByNameForTenantQueryHandler,
    FindNvrBySerialNumberQueryHandler,
  ],
  ...[
    FindAllCamerasQueryHandler,
    FindAllCamerasForTenantQueryHandler,
    FindCameraByIdQueryHandler,
    FindCameraByIdForTenantQueryHandler,
    FindCameraByNameQueryHandler,
    FindCameraByNameForTenantQueryHandler,
    FindCameraByNameAndNvrIdQueryHandler,
    FindCameraBySerialNumberQueryHandler,
    FindAllDeletedCamerasByDeletedSerialNumbersQueryHandler,
  ],
];
const apiServiceForAnotherModules: Provider[] = [
  VideoDevicesApiForDashboardService,
  VideoDevicesApiForFogCommunicationManagerService,
  VideoDevicesApiforTrashService,
];
const repositories: Provider[] = [
  { provide: NVR_REPOSITORY, useClass: NvrRepository },
  { provide: CAMERA_REPOSITORY, useClass: CameraRepository },
];

const mappers: Provider[] = [NvrMapper, CameraMapper];

const queueServices: Provider[] = [
  ...[VideoDeviceConfigQueueService, VideoDeviceDataQueueService],
];

const services: Provider[] = [
  NvrsHttpService,
  CamerasHttpService,
  NvrRunningConfigService,
  CameraRunningConfigAndCommandService,
  NvrLiveSignalService,
  CameraLiveSignalService,
  NvrActorLogService,
  CameraActorLogService,
  NvrSystemLogService,
  CameraSystemLogService,
  NvrMqttService,
  CameraMqttService,
];

const validators: Provider[] = [NvrValidator, CameraValidator];

const mqttControllers: Provider[] = [VideoDevicesConfigsMqttController];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CameraModel.name, schema: CameraSchema },
      { name: NvrModel.name, schema: NvrSchema },
    ]),
    CachingModule,
    CqrsModule,
    SanawApiModule,
    MqttModule,
    WsModule,
    QueueModule,
    forwardRef(() => ActorLogModule),
    forwardRef(() => SmsNotifierModule),
    SystemLogModule,
    forwardRef(() => DashboardModule),
  ],
  providers: [
    ...services,
    ...validators,
    ...mqttControllers,
    ...queryHandlers,
    ...repositories,
    ...mappers,
    ...commandHandlers,
    ...queueServices,
    ...apiServiceForAnotherModules,
    VideoDeviceInitService,
  ],
  controllers: [
    NvrHttpController,
    CamerasHttpController,
    FogCommunicationHttpController,
  ],
  exports: [...apiServiceForAnotherModules],
})
export class VideoDevicesModule {}
