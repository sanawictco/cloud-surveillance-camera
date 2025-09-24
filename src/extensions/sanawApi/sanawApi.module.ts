import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SanawApiDeviceService } from './services/sanawApiDevice.service';
import { SanawApiNotificationService } from './services/sanawApiNotification.service';
import { SanawApiEmployeeService } from './services/sanawApiEmployee.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
  ],
  providers: [
    SanawApiDeviceService,
    SanawApiNotificationService,
    SanawApiEmployeeService,
  ],
  exports: [
    SanawApiDeviceService,
    SanawApiNotificationService,
    SanawApiEmployeeService,
  ],
})
export class SanawApiModule {}
