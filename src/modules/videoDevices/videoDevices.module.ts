import { Module, Provider, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { CachingModule } from 'src/extensions/caching/cacheing.module';
import { MqttModule } from 'src/extensions/mqtt/mqtt.module';
import { QueueModule } from 'src/extensions/queue/queue.module';
import { SanawApiModule } from 'src/extensions/sanawApi/sanawApi.module';
import { WsModule } from 'src/extensions/websocket/ws.module';
import { ActorLogModule } from '../actorLogs/actorLog.module';
import { EmployeeModule } from '../employees/employees.module';
import { SystemLogModule } from '../systemLogs/systemLog.module';
import { CreateCameraCommandHandler } from './applicationService/commands/camera/createCamera.command';
import { UpdateCameraCommandHandler } from './applicationService/commands/camera/updateCamera.command';
import { FindAllCamerasQueryHandler } from './applicationService/queries/camera/findAllCameras.queryHandler';
import { FindCameraByIdQueryHandler } from './applicationService/queries/camera/findCameraById.queryHandler';
import { FindCameraByNameQueryHandler } from './applicationService/queries/camera/findCameraByName.queryHandler';
import { FindCameraByNameAndNvrIdQueryHandler } from './applicationService/queries/camera/findCameraByNameAndNvrId.queryHandler';
import { VideoDevicesInitService } from './applicationService/services/init.service';
import { CreateNvrCommandHandler } from './applicationService/commands/nvr/createNvr.command';
import { UpdateNvrCommandHandler } from './applicationService/commands/nvr/updateNvr.command';
import { DeleteNvrCommandHandler } from './applicationService/commands/nvr/deleteNvr.command';
import { RestoreNvrsToCacheCommandHandler } from './applicationService/commands/nvr/restoreNvrsToCache.command';
import { ActiveCameraCommandHandler } from './applicationService/commands/camera/activeCamera.command';
import { InActiveCameraCommandHandler } from './applicationService/commands/camera/inactiveCamera.command';
import { ActiveNvrCommandHandler } from './applicationService/commands/nvr/activeNvr.command';
import { InActiveNvrCommandHandler } from './applicationService/commands/nvr/inactiveNvr.command';
import { FindAllNvrsQueryHandler } from './applicationService/queries/nvr/findAllNvrs.queryHandler';
import { FindNvrByIdQueryHandler } from './applicationService/queries/nvr/findNvrById.queryHandler';
import { FindNvrByNameQueryHandler } from './applicationService/queries/nvr/findNvrByName.queryHandler';
import { FindNvrBySerialNumberQueryHandler } from './applicationService/queries/nvr/findNvrBySerialNumber.queryHandler';
import { NVR_REPOSITORY } from './infra/nvr/nvr.diToken';
import { NvrRepository } from './infra/nvr/nvr.repository';
import { NvrMapper } from './infra/nvr/nvr.mapper';
import { CAMERA_REPOSITORY } from './infra/camera/camera.diToken';
import { CameraMapper } from './infra/camera/camera.mapper';
import { CameraRepository } from './infra/camera/camera.repository';
import { CameraModel, CameraSchema } from './infra/camera/camera.schema';
import { FindCameraBySerialNumberQueryHandler } from './applicationService/queries/camera/findCameraBySerialNumber.queryHandler';
import { DeleteCameraCommandHandler } from './applicationService/commands/camera/deleteCamera.command';
import { RestoreCamerasToCacheCommandHandler } from './applicationService/commands/camera/restoreCamerasToCache.command';
import { FindAllDeletedCamerasByDeletedSerialNumbersQueryHandler } from './applicationService/queries/camera/findAllDeletedCamerasByDeletedSerialNumbers.queryHandler';
import { VideoDevicesApiForDashboardService } from './applicationService/services/apiForAnotherServices/videoDevicesApiForDashboard.service';
import { VideoDevicesApiForFogCommunicationManagerService } from './applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service';
import { NvrValidator } from './applicationService/services/http/validators/nvr.validator';
import { CameraValidator } from './applicationService/services/http/validators/camera.validator';
import { VideoDeviceConfigQueueService } from './applicationService/services/queues/videoDeviceConfig/videoDeviceQueue.service';
import { VideoDeviceDataQueueService } from './applicationService/services/queues/videoDeviceData/videoDeviceDataQueue.service';

const commandHandlers: Provider[] = [
  ...[
    CreateNvrCommandHandler,
    UpdateNvrCommandHandler,
    DeleteNvrCommandHandler,
    ActiveNvrCommandHandler,
    InActiveNvrCommandHandler,
    RestoreNvrsToCacheCommandHandler,
  ],
  ...[
    CreateCameraCommandHandler,
    UpdateCameraCommandHandler,
    DeleteCameraCommandHandler,
    CreateCameraCommandHandler,
    ActiveCameraCommandHandler,
    InActiveCameraCommandHandler,
    RestoreCamerasToCacheCommandHandler,
  ],
];
const queryHandlers: Provider[] = [
  ...[
    FindAllNvrsQueryHandler,
    FindNvrByIdQueryHandler,
    FindNvrByNameQueryHandler,
    FindNvrBySerialNumberQueryHandler,
  ],
  ...[
    FindAllCamerasQueryHandler,
    FindCameraByIdQueryHandler,
    FindCameraByNameQueryHandler,
    FindCameraByNameAndNvrIdQueryHandler,
    FindCameraBySerialNumberQueryHandler,
    FindAllDeletedCamerasByDeletedSerialNumbersQueryHandler,
  ],
];
const apiServiceForAnotherModules: Provider[] = [
  VideoDevicesApiForDashboardService,
  VideoDevicesApiForFogCommunicationManagerService,
];
const repositories: Provider[] = [
  { provide: NVR_REPOSITORY, useClass: NvrRepository },
  { provide: CAMERA_REPOSITORY, useClass: CameraRepository },
];

const mappers: Provider[] = [NvrMapper, CameraMapper];

const queueServices: Provider[] = [
  ...[VideoDeviceConfigQueueService, VideoDeviceDataQueueService],
];

const services: Provider[] = [];

const validators: Provider[] = [NvrValidator, CameraValidator];

const mqttControllers: Provider[] = [];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CameraModel.name, schema: CameraSchema },
    ]),
    CachingModule,
    CqrsModule,
    SanawApiModule,
    MqttModule,
    WsModule,
    QueueModule,
    forwardRef(() => ActorLogModule),
    forwardRef(() => EmployeeModule),
    SystemLogModule,
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
    VideoDevicesInitService,
  ],
  controllers: [],
  exports: [...apiServiceForAnotherModules],
})
export class VideoDevicesModule {}
