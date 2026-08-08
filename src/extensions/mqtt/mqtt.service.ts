import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import AppConfig from 'configs/app.config';
import { connect, MqttClient } from 'mqtt';
import { ServiceProvider } from '../serviceProvider/serviceProvider.service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const MqttPattern = require('mqtt-pattern');

@Injectable()
export class MqttService implements OnApplicationBootstrap {
  private mqttClient!: MqttClient;
  constructor(private readonly serviceProvider: ServiceProvider) {}

  async onApplicationBootstrap() {
    const connectUrl = `${AppConfig().mqtt.server.host}:${
      AppConfig().mqtt.server.port
    }`;
    this.mqttClient = connect(connectUrl, {
      ...AppConfig().mqtt.server,
    });
    this.mqttClient.on('connect', () => {
      this.serviceProvider.logger.log(
        '__________________Connected to mqtt server',
      );
    });

    this.mqttClient.on('error', (err: Error) => {
      this.serviceProvider.logger.error(`mqtt connection error !!! ${err}`);
      process.exit(1);
    });

    this.mqttClient.on('disconnect', async () => {
      this.serviceProvider.logger.warn(
        '*************mqtt client is disconnected*************',
      );
      await this.mqttReconnect();
    });

    this.mqttClient.on('offline', async () => {
      this.serviceProvider.logger.warn(
        '****************mqtt client is offline***************',
      );
      await this.mqttReconnect();
    });

    const topicsPatterns = [...new Set([])];
    for (const pattern of topicsPatterns) {
      await this.subscribe(pattern);
    }

    await this.handleMqttMessages(topicsPatterns);
  }

  async mqttReconnect() {
    return new Promise<void>((resolve, reject) => {
      this.mqttClient.end(true, {}, () => {
        this.mqttClient.reconnect();
        resolve();
      });
      reject('error occured');
    });
  }

  async publish(
    topic: string,
    data: string | object,
    qos: 0 | 1 | 2 = 2,
  ): Promise<void> {
    this.mqttClient.publish(
      topic,
      typeof data === 'string' ? data : JSON.stringify(data),
      { qos },
      (err?: Error) => {
        if (err) console.error('Error', `mqtt client.publish failed => ${err}`);
      },
    );
    console.log('Publish message on mqtt => ', { topic, data });
  }

  async subscribe(topic: string, qos: 0 | 1 | 2 = 2) {
    this.mqttClient.subscribe(topic, { qos }, (err?: Error | null) => {
      if (err) console.error('Error', `mqtt client.subscribe failed => ${err}`);
    });
  }

  async handleMqttMessages(topicsPatterns: string[]) {
    this.mqttClient.on('message', async (topic: string, message: Buffer) => {
      const messageText = message.toString();
      console.log('Receive message on mqtt => ', {
        topic,
        message: messageText,
      });
      for (const pattern of topicsPatterns)
        if (MqttPattern.matches(pattern, topic)) {
          await this.serviceProvider.eventEmitter.emit(pattern, {
            topic,
            message: messageText,
          });
        }
    });
  }
}
