import { Module, Provider, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { SanawApiModule } from '../../extensions/sanawApi/sanawApi.module';

import { MqttModule } from '../../extensions/mqtt/mqtt.module';
import { WsModule } from 'src/extensions/websocket/ws.module';
import { QueueModule } from 'src/extensions/queue/queue.module';
import { CachingModule } from 'src/extensions/caching/cacheing.module';

import { DeletePageCommandHandler } from './applicationService/commands/deletePage.command';
import { UpdatePageCommandHandler } from './applicationService/commands/updatePage.command';
import {
  FindAllPagesForTenantQueryHandler,
  FindAllPagesQueryHandler,
} from './applicationService/queries/findAllPages.queryHandler';
import {
  FindPageByIdForTenantQueryHandler,
  FindPageByIdQueryHandler,
} from './applicationService/queries/findPageById.queryHandler';
import { FindPageByNameQueryHandler } from './applicationService/queries/findPageByName.queryHandler';
import { CreatePageCommandHandler } from './applicationService/commands/createPage.command';
import { PAGE_REPOSITORY } from './infra/diTokens/page.diToken';
import { PageRepository } from './infra/repositories/page.repository';
import { PageMapper } from './infra/mappers/page.mapper';
import { PagesHttpService } from './applicationService/services/page.http.service';
import { PageModel, PageSchema } from './infra/schemas/page.schema';
import { PageHttpController } from './controllers/page.http.controller';
import { DashboardDataController } from './controllers/dashboardData.controller';
import { DashboardApiForFogCommunicationManagerService } from './applicationService/apiForAnotherServices/dashboardApiForFogCommunicationManager.service';
import { SmsNotifierModule } from '../smsNotifier/smsNotifier.module';
import { PageActorLogService } from './applicationService/services/pageActorLog.service';
import { ActorLogModule } from '../actorLogs/actorLog.module';
import { DashboardInitService } from './applicationService/services/init.service';
import { PagesMqttService } from './applicationService/services/page.mqtt.service';
import { PageSystemLogService } from './applicationService/services/pageSystemLog.service';
import { PageRunningConfigService } from './applicationService/services/pageRunningConfig.service';
import { SystemLogModule } from '../systemLogs/systemLog.module';
import { PageConfigQueueService } from './applicationService/services/queues/pageConfigQueue.service';
import { RestorePagesToCacheCommandHandler } from './applicationService/commands/restorePagesToCache.command';
import { PageMqttController } from './controllers/page.mqtt.controller';
import { DashboardApiForRuleChainsService } from './applicationService/apiForAnotherServices/dashboardApiForRuleChains.service';
import {
  FindPageByNameAndNvrIdForTenantQueryHandler,
  FindPageByNameAndNvrIdQueryHandler,
} from './applicationService/queries/findPageByNameAndNvrId.queryHandler';
import { DashboardDataService } from './applicationService/services/dashboardData.service';
import { VideoDevicesModule } from '../videoDevices/videoDevices.module';
import { DashboardApiForVideoDevicesService } from './applicationService/apiForAnotherServices/dashboardApiForDevices.service';
import { UnlockPageRunningConfigCommandHandler } from './applicationService/commands/unlockPageRunningConfig.command';

const commandHandlers: Provider[] = [
  ...[
    CreatePageCommandHandler,
    UpdatePageCommandHandler,
    DeletePageCommandHandler,
    RestorePagesToCacheCommandHandler,
    UnlockPageRunningConfigCommandHandler,
  ],
];
const queryHandlers: Provider[] = [
  ...[
    FindAllPagesQueryHandler,
    FindAllPagesForTenantQueryHandler,
    FindPageByIdQueryHandler,
    FindPageByIdForTenantQueryHandler,
    FindPageByNameQueryHandler,
    FindPageByNameAndNvrIdQueryHandler,
    FindPageByNameAndNvrIdForTenantQueryHandler,
  ],
];
const apiServiceForAnotherModules: Provider[] = [
  DashboardApiForFogCommunicationManagerService,
  DashboardApiForRuleChainsService,
  DashboardApiForVideoDevicesService,
];
const repositories: Provider[] = [
  { provide: PAGE_REPOSITORY, useClass: PageRepository },
];

const mappers: Provider[] = [PageMapper];

const services: Provider[] = [
  PagesHttpService,
  PagesMqttService,
  DashboardDataService,
  PageActorLogService,
  PageSystemLogService,
  PageRunningConfigService,
  PageConfigQueueService,
];

const mqttControllers: Provider[] = [PageMqttController];

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PageModel.name, schema: PageSchema }]),
    CachingModule,
    CqrsModule,
    SanawApiModule,
    MqttModule,
    WsModule,
    QueueModule,
    forwardRef(() => ActorLogModule),
    forwardRef(() => VideoDevicesModule),
    forwardRef(() => SmsNotifierModule),
    SystemLogModule,
  ],
  providers: [
    ...services,
    ...mqttControllers,
    ...queryHandlers,
    ...repositories,
    ...mappers,
    ...commandHandlers,
    ...apiServiceForAnotherModules,
    DashboardInitService,
  ],
  controllers: [PageHttpController, DashboardDataController],
  exports: [...apiServiceForAnotherModules],
})
export class DashboardModule {}
