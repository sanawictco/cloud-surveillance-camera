import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VideoDevicesModule } from '../videoDevices/videoDevices.module';
import { TrashService } from './applicationService/services/trash.service';
import { TrashController } from './controllers/trash.controller';
@Module({
  imports: [ConfigModule, VideoDevicesModule],

  providers: [TrashService],
  controllers: [TrashController],
  exports: [],
})
export class TrashModule {}
