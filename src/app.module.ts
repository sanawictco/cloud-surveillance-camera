import { Module } from '@nestjs/common';
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
import { AppController } from './app.controller';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ContextInterceptor } from './utilities/context.interceptor';
import { GlobalExceptionFilter } from './utilities/exception.filter';

@Module({
  imports: [
    ShutdownModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
      load: [AppConfig],
    }),
    LoggerModule,
    TranslatorModule,
    ServiceProviderModule,
    SerializerModule,
    UserInfoModule,
    EventEmitterModule.forRoot(),
    RequestContextModule,
    CqrsModule,
    WsModule,
    QueueModule,
    SchedulerModule,
    MqttModule,
    CachingModule,
    TDengineModule,
    MongoModule,
    TenantsModule,
  ],
  controllers: [AppController],
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
export class AppModule {}
