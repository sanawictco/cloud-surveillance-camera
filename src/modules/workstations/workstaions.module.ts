import { Module, Provider, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { CachingModule } from 'src/extensions/caching/cacheing.module';
import { SanawApiModule } from 'src/extensions/sanawApi/sanawApi.module';
import { ActorLogModule } from '../actorLogs/actorLog.module';
import { CreateWorkstationCommandHandler } from './applicationService/commands/createWorkstation.command';
import { DeleteWorkstationCommandHandler } from './applicationService/commands/deleteWorkstation.command';
import { UpdateWorkstationCommandHandler } from './applicationService/commands/updateWorkstation.command';
import { FindAllWorkstationsQueryHandler } from './applicationService/queries/findAllWorkstations.queryHandler';
import { FindWorkstationByIdQueryHandler } from './applicationService/queries/findWorkstationById.queryHandler';
import { FindWorkstationByNameQueryHandler } from './applicationService/queries/findWorkstationByName.queryHandler';
import { WorkstationInitService } from './applicationService/services/init.service';
import { WorkstationsActorLogService } from './applicationService/services/workstationActorLog.service';
import { WORKSTATION_REPOSITORY } from './infra/workstation.diToken';
import { WorkstationMapper } from './infra/workstation.mapper';
import { WorkstationRepository } from './infra/workstation.repository';
import {
  WorkstationModel,
  WorkstationSchema,
} from './infra/workstation.schema';

const commandHandlers: Provider[] = [
  ...[
    CreateWorkstationCommandHandler,
    UpdateWorkstationCommandHandler,
    DeleteWorkstationCommandHandler,
    CreateWorkstationCommandHandler,
  ],
];

const queryHandlers: Provider[] = [
  ...[
    FindAllWorkstationsQueryHandler,
    FindWorkstationByIdQueryHandler,
    FindWorkstationByNameQueryHandler,
  ],
];

const mappers: Provider[] = [WorkstationMapper];
const repositories: Provider[] = [
  { provide: WORKSTATION_REPOSITORY, useClass: WorkstationRepository },
];
const httpServices: Provider[] = [WorkstationsActorLogService];

const apiServicesForAnotherModules: Provider[] = [];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkstationModel.name, schema: WorkstationSchema },
    ]),
    ConfigModule,
    CqrsModule,
    SanawApiModule,
    CachingModule,
    forwardRef(() => ActorLogModule),
  ],

  providers: [
    ...httpServices,
    ...commandHandlers,
    ...queryHandlers,
    ...mappers,
    ...repositories,
    ...apiServicesForAnotherModules,
    WorkstationInitService,
  ],
  controllers: [],
  exports: [...apiServicesForAnotherModules],
})
export class WorkstationsModule {}
