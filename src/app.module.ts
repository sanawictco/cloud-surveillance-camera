import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import AppConfig from 'configs/app.config';
import { RequestContextModule } from 'nestjs-request-context';
import { CachingModule } from './extensions/caching/cacheing.module';
import { LoggerModule } from './extensions/logger/logger.module';
import { MongoModule } from './extensions/mongo/mongo.module';
import { MqttModule } from './extensions/mqtt/mqtt.module';
import { QueueModule } from './extensions/queue/queue.module';
import { SchedulerModule } from './extensions/scheduler/scheduler.module';
import { SerializerModule } from './extensions/serialization/serializer.module';
import { ServiceProviderModule } from './extensions/serviceProvider/serviceProvider.module';
import { ServiceProvider } from './extensions/serviceProvider/serviceProvider.service';
import { ShutdownModule } from './extensions/shutdown/shutdown.module';
import { TDengineModule } from './extensions/tdengine/tdengine.module';
import { TranslatorModule } from './extensions/translation/translator.module';
import { UserInfoModule } from './extensions/userInfo/userInfo.module';
import { WsModule } from './extensions/websocket/ws.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ContextInterceptor } from './utilities/context.interceptor';
import { GlobalExceptionFilter } from './utilities/exception.filter';
import { VideoDevicesModule } from './modules/videoDevices/videoDevices.module';
import { ProtectionMiddleware } from './utilities/auth/protection.middleware';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SystemLogModule } from './modules/systemLogs/systemLog.module';
import { FogCommunicationManagerModule } from './modules/fogCommunicationManager/fogCommunicationManager.module';
import { SmsNotifierModule } from './modules/smsNotifier/smsNotifier.module';
import { ActorLogModule } from './modules/actorLogs/actorLog.module';
import { SystemMonitorModule } from './modules/systemMonitor/systemMonitor.module';
import { TrashModule } from './modules/trash/trash.module';
import { TenantAccessModule } from './modules/tenantAccess/tenantAccess.module';

@Module({
  imports: [
    // ── MUST be first: ShutdownModule is @Global and must be ready
    //    before any other module registers a shutdown handler ──────────────────
    ShutdownModule, // 1. always first
    // Infrastructure modules (no shutdown handlers yet)
    LoggerModule,
    TranslatorModule,
    ServiceProviderModule,
    SerializerModule,
    UserInfoModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
      load: [AppConfig],
    }),
    EventEmitterModule.forRoot(),
    RequestContextModule,
    CqrsModule,
    ScheduleModule.forRoot(),
    // Shutdown-ordered (registration order = shutdown order)
    WsModule, // 2. WebSocket first
    QueueModule, // 3. Queue infrastructure
    SchedulerModule, // 4. Scheduler (uses QueueModule)
    MqttModule, // 5. MQTT
    CachingModule, // 6. Cache
    TDengineModule, // 7. TDengine
    TenantAccessModule,

    // Domain modules
    VideoDevicesModule,
    DashboardModule,
    TenantsModule,
    SystemLogModule,
    TrashModule,
    FogCommunicationManagerModule,
    SmsNotifierModule,
    ActorLogModule,
    SystemMonitorModule,
    // 8. Always last - domain modules read from it during shutdown
    MongoModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ContextInterceptor,
    },
    ServiceProvider,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProtectionMiddleware)
      .exclude(
        {
          path: '/fog-communication-manager/configs',
          method: RequestMethod.POST,
        },
        {
          path: '/fog-communication-manager/restore-fog-backup-to-cloud',
          method: RequestMethod.POST,
        },
        {
          path: '/system-monitor/health',
          method: RequestMethod.GET,
        },
      )
      .forRoutes('*');
  }
}
