import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import AppConfig from 'configs/app.config';
import { connect, MqttClient } from 'mqtt';
import { CameraCloudSubOnFogMqttTopics } from 'src/modules/videoDevices/domain/camera/camera.type';
import { NvrCloudSubOnFogMqttTopics } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { ServiceProvider } from '../serviceProvider/serviceProvider.service';
import {
  IShutdownHandler,
  ShutdownOrchestratorService,
} from '../shutdown/shutdown.service';

type MqttQos = 0 | 1 | 2;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MqttPattern = require('mqtt-pattern');

@Injectable()
export class MqttService
  implements
    OnApplicationBootstrap,
    OnModuleInit,
    IShutdownHandler,
    OnModuleDestroy
{
  private mqttClient!: MqttClient;
  private _isShutDown = false;

  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly shutdownOrchestrator: ShutdownOrchestratorService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.shutdownOrchestrator.registerHandler('MQTT', this);
  }

  async onApplicationBootstrap(): Promise<void> {
    const server = AppConfig().mqtt.server;
    const brokerUrl = server.host.includes('://')
      ? server.host
      : `mqtt://${server.host}`;
    const connectUrl = `${brokerUrl}:${server.port}`;
    this.mqttClient = connect(connectUrl, {
      username: server.username,
      password: server.password,
      clientId: server.clientId,
      clean: server.clean,
      keepalive: server.keepalive,
      reconnectPeriod: 1000,
      resubscribe: true,
    });

    this.mqttClient.on('connect', () => {
      this.serviceProvider.logger.log('Connected to mqtt server');
    });
    this.mqttClient.on('error', (err: Error) => {
      this.serviceProvider.logger.error('MQTT connection error', err);
    });
    this.mqttClient.on('disconnect', () => {
      this.serviceProvider.logger.warn('MQTT client is disconnected');
    });
    this.mqttClient.on('offline', () => {
      this.serviceProvider.logger.warn('MQTT client is offline');
    });
    this.mqttClient.on('reconnect', () => {
      this.serviceProvider.logger.warn('MQTT client is reconnecting');
    });

    const textPatterns = [
      ...new Set([
        ...Object.values(NvrCloudSubOnFogMqttTopics),
        ...Object.values(CameraCloudSubOnFogMqttTopics),
      ]),
    ];
    for (const pattern of textPatterns) {
      await this.subscribe(pattern);
    }
    this.handleMqttMessages(textPatterns);
  }

  async shutdown(): Promise<void> {
    if (this._isShutDown) return;
    this._isShutDown = true;
    if (!this.mqttClient) return;

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve();
      };
      const timeoutId = setTimeout(() => {
        this.serviceProvider.logger.warn(
          'MQTT graceful close timed out after 5s - forcing',
        );
        this.mqttClient.end(true, {}, done);
      }, 5_000);
      this.mqttClient.end(false, {}, () => {
        this.serviceProvider.logger.log('MQTT disconnected gracefully');
        done();
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this._isShutDown) return;
    if (this.shutdownOrchestrator.isShuttingDown) return;
    await this.shutdown();
  }

  async publish(
    topic: string,
    data: string | object,
    qos: MqttQos = 2,
  ): Promise<void> {
    if (this._isShutDown) throw new Error('Cannot publish during shutdown');
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.mqttClient.publish(topic, payload, { qos }, (err?: Error) => {
      if (err) {
        this.serviceProvider.logger.error(
          `MQTT publish failed for topic ${topic}`,
          err,
        );
      }
    });
    this.serviceProvider.logger.debug(`Publish message on MQTT => ${topic}`);
  }

  async publishBinary(
    topic: string,
    data: Buffer,
    qos: MqttQos = 2,
  ): Promise<void> {
    if (this._isShutDown) throw new Error('Cannot publish during shutdown');
    this.mqttClient.publish(topic, data, { qos }, (err?: Error) => {
      if (err) {
        this.serviceProvider.logger.error(
          `MQTT binary publish failed for topic ${topic}`,
          err,
        );
      }
    });
  }

  async subscribe(topic: string, qos: MqttQos = 2): Promise<void> {
    this.mqttClient.subscribe(topic, { qos }, (err?: Error | null) => {
      if (err) {
        this.serviceProvider.logger.error(
          `MQTT subscribe failed for topic ${topic}`,
          err,
        );
      }
    });
  }

  handleMqttMessages(textPatterns: string[]): void {
    this.serviceProvider.logger.debug(
      `MQTT subscribed patterns: ${textPatterns.join(', ')}`,
    );
    this.mqttClient.on('message', (topic: string, message: Buffer) => {
      this.serviceProvider.logger.debug(`Receive message on MQTT => ${topic}`);
      const decoded = message.toString();
      for (const pattern of textPatterns) {
        if (MqttPattern.matches(pattern, topic)) {
          this.serviceProvider.eventEmitter.emit(pattern, {
            topic,
            message: decoded,
          });
        }
      }
    });
  }
}
