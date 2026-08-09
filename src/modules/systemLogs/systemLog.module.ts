import { Module, Provider, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SanawApiModule } from '../../extensions/sanawApi/sanawApi.module';
import { WsModule } from 'src/extensions/websocket/ws.module';
import { CreateSystemLogCommandHandler } from './applicationService/commands/systemLog/createSystemLog.command';
import { FindAllSystemLogsQueryHandler } from './applicationService/queries/systemLog/findAllSystemLogs.queryHandler';
import { SYSTEM_LOG_REPOSITORY } from './infra/diToken/systemLog.diToken';
import { SystemLogService } from './applicationService/services/systemLog.service';
import { SystemLogController } from './controllers/systemLog.controller';
import { FogNotificationController } from './controllers/fogNotification.controller';
import { SystemLogApiService } from './applicationService/apiForAnotherServices/systemLogApi.service';
import { EmployeeModule } from '../employees/employees.module';
import { CountAllSystemLogsQueryHandler } from './applicationService/queries/systemLog/countAllSystemLogs.queryHandler';
import { DeleteAllSystemLogCommandHandler } from './applicationService/commands/systemLog/deleteAllSystemLog.command';
import { FindAllPaginatedSystemLogsQueryHandler } from './applicationService/queries/systemLog/findAllPaginatedSystemLogs.queryHandler';
import { SystemLogRepository } from './infra/repositories/systemLog.timeseriesRepository';
import { TDengineModule } from 'src/extensions/tdengine/tdengine.module';

const commandHandlers: Provider[] = [
  CreateSystemLogCommandHandler,
  DeleteAllSystemLogCommandHandler,
];

const queryHandlers: Provider[] = [
  FindAllSystemLogsQueryHandler,
  FindAllPaginatedSystemLogsQueryHandler,
  CountAllSystemLogsQueryHandler,
];

const repositories: Provider[] = [
  { provide: SYSTEM_LOG_REPOSITORY, useClass: SystemLogRepository },
];

const apiServicesForAnotherModules: Provider[] = [SystemLogApiService];

const httpServices: Provider[] = [SystemLogService];

@Module({
  imports: [
    CqrsModule,
    SanawApiModule,
    WsModule,
    TDengineModule,
    forwardRef(() => EmployeeModule),
  ],
  providers: [
    ...httpServices,
    ...queryHandlers,
    ...repositories,
    ...commandHandlers,
    ...apiServicesForAnotherModules,
  ],
  controllers: [SystemLogController, FogNotificationController],
  exports: [SystemLogService, SystemLogApiService],
})
export class SystemLogModule {}
