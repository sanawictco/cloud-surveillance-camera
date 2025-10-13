import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SanawApiNotificationService } from './services/sanawApiNotification.service';
import { SanawApiEmployeeService } from './services/sanawApiEmployee.service';
import { SanawApiVideoDeviceService } from './services/sanawApiVideoDevice.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
  ],
  providers: [
    SanawApiVideoDeviceService,
    SanawApiNotificationService,
    SanawApiEmployeeService,
  ],
  exports: [
    SanawApiVideoDeviceService,
    SanawApiNotificationService,
    SanawApiEmployeeService,
  ],
})
export class SanawApiModule {}
