import { forwardRef, Module, Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ActorLogApiService } from './applicationService/services/actorLogApi.service';
import { ACTOR_LOG_REPOSITORY } from './infra/actorLog.diToken';
import { ActorLogRepository } from './infra/actorLog.timeseriesRepository';
import { CreateActorLogCommandHandler } from './applicationService/commands/createActorLog.command';
import { DeleteTenantActorLogsCommandHandler } from './applicationService/commands/deleteTenantActorLogs.command';
import { FindAllActorLogsQueryHandler } from './applicationService/queries/findAllActorLogs.queryHandler';
import { FindAllPaginatedActorLogsQueryHandler } from './applicationService/queries/findAllPaginatedActorLogs.queryHandler';
import { CountAllActorLogsQueryHandler } from './applicationService/queries/countAllActorLogs.queryHandler';
import { TDengineModule } from 'src/extensions/tdengine/tdengine.module';
import { ActorLogController } from './actorLog.controller';
import { ActorLogsService } from './applicationService/services/actorLog.service';
import { TenantAccessModule } from '../tenantAccess/tenantAccess.module';

const commandHandlers: Provider[] = [
  CreateActorLogCommandHandler,
  DeleteTenantActorLogsCommandHandler,
];
const queryHandlers: Provider[] = [
  FindAllActorLogsQueryHandler,
  FindAllPaginatedActorLogsQueryHandler,
  CountAllActorLogsQueryHandler,
];
const apiServicesForAnotherModules: Provider[] = [ActorLogApiService];
const repositories: Provider[] = [
  { provide: ACTOR_LOG_REPOSITORY, useClass: ActorLogRepository },
];
@Module({
  imports: [CqrsModule, TDengineModule, forwardRef(() => TenantAccessModule)],
  providers: [
    ActorLogsService,
    ...queryHandlers,
    ...repositories,
    ...commandHandlers,
    ...apiServicesForAnotherModules,
  ],
  controllers: [ActorLogController],
  exports: [ActorLogApiService],
})
export class ActorLogModule {}
