import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { ConfigModule } from '@nestjs/config';
import { MqttApiService } from './mqttApi.service';
@Global()
@Module({
  imports: [ConfigModule],

  providers: [MqttService, MqttApiService],
  exports: [MqttApiService, MqttService],
})
export class MqttModule {}
