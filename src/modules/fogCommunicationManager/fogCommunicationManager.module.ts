import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { MqttModule } from 'src/extensions/mqtt/mqtt.module';
import { WsModule } from 'src/extensions/websocket/ws.module';
import { VideoDevicesModule } from '../videoDevices/videoDevices.module';
import { FogCommunicationManagerController } from './fogCommunicationManager.controller';
import { FogCommunicationManagerService } from './fogCommunicationManager.service';
import { MulterModule } from '@nestjs/platform-express';
import { FogBackupAuthGuard } from './fogBackupAuth.guard';
import { ActorLogModule } from '../actorLogs/actorLog.module';
import { SystemLogModule } from '../systemLogs/systemLog.module';
import { TDengineModule } from 'src/extensions/tdengine/tdengine.module';
@Module({
  imports: [
    MulterModule.register({
      dest: process.env.FOG_BACKUP_ROOT ?? '/cloud_shared_backups',
    }),
    ConfigModule,
    VideoDevicesModule,
    CqrsModule,
    MqttModule,
    WsModule,
    ActorLogModule,
    SystemLogModule,
    TDengineModule,
  ],

  providers: [FogCommunicationManagerService, FogBackupAuthGuard],
  controllers: [FogCommunicationManagerController],
  exports: [],
})
export class FogCommunicationManagerModule {}
