import { Module } from '@nestjs/common';
import { TDengineModule } from 'src/extensions/tdengine/tdengine.module';
import { SystemMonitorController } from './systemMonitor.controller';
import { SystemMonitorService } from './systemMonitor.service';

@Module({
  imports: [TDengineModule],
  providers: [SystemMonitorService],
  exports: [],
  controllers: [SystemMonitorController],
})
export class SystemMonitorModule {}
