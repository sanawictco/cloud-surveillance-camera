import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { MulterModule } from '@nestjs/platform-express';
import { MqttModule } from 'src/extensions/mqtt/mqtt.module';
import { WsModule } from 'src/extensions/websocket/ws.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { VideoDevicesModule } from '../videoDevices/videoDevices.module';
import { FogCommunicationManagerController } from './fogCommunicationManager.controller';
import { FogCommunicationManagerService } from './fogCommunicationManager.service';
import { HttpModule } from 'src/extensions/http/http.module';
@Module({
  imports: [
    MulterModule.register({
      dest: '/cloud_shared_backups',
    }),
    ConfigModule,
    VideoDevicesModule,
    CqrsModule,
    MqttModule,
    WsModule,
    DashboardModule,
    HttpModule,
  ],

  providers: [FogCommunicationManagerService],
  controllers: [FogCommunicationManagerController],
  exports: [],
})
export class FogCommunicationManagerModule {}
