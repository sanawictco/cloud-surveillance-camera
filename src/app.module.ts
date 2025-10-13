import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import AppConfig from 'configs/app.config';
import { RequestContextModule } from 'nestjs-request-context';
import { MqttModule } from './extensions/mqtt/mqtt.module';
import { SchedulerModule } from './extensions/scheduler/scheduler.module';
import { SerializerModule } from './extensions/serialization/serializer.module';
import { ServiceProviderModule } from './extensions/serviceProvider/serviceProvider.module';
import { TranslatorModule } from './extensions/translation/translator.module';
import { UserInfoModule } from './extensions/userInfo/userInfo.module';
import { WsModule } from './extensions/websocket/ws.module';
import { ContextInterceptor } from './utilities/context.interceptor';
import { GlobalExceptionFilter } from './utilities/exception.filter';
import { LoggerModule } from './extensions/logger/logger.module';
import { CachingModule } from './extensions/caching/cacheing.module';
import { AppController } from './app.controller';
import {
  TDENGINE_CLIENT,
  TDENGINE_RESTFULL_OPTIONS,
  TimeseriesRepository,
} from './modules/shared/timeseriesRepository';
import { ServiceProvider } from './extensions/serviceProvider/serviceProvider.service';
import { WorkstationsModule } from './modules/workstations/workstaions.module';
const taos = require('@tdengine/websocket');

@Module({
  imports: [
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
    SchedulerModule,
    MqttModule,
    MongooseModule.forRoot(AppConfig().mongodb.url),
    CachingModule,
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
    {
      provide: TDENGINE_CLIENT,
      useFactory: async () => {
        const { wsUrl, user, password, dbName } = AppConfig().timeseriesDb;
        const conf = new taos.WSConfig(wsUrl);
        conf.setUser(user);
        conf.setPwd(password);
        conf.setDb(dbName);
        conf.setTimeOut(500);
        const tdengineClient = await taos.sqlConnect(conf);
        await tdengineClient.exec(`USE ${AppConfig().timeseriesDb.dbName}`);
        return tdengineClient;
      },
    },
    {
      provide: TDENGINE_RESTFULL_OPTIONS,
      useFactory: async () => {
        return {
          restUrl: AppConfig().timeseriesDb.restUrl,
          token: AppConfig().timeseriesDb.token,
        };
      },
    },
    TimeseriesRepository,
    ServiceProvider,
    WorkstationsModule,
  ],
})
export class AppModule {}
