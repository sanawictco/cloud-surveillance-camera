import { INestApplication } from '@nestjs/common';
import * as bodyParser from 'body-parser';

export const API_NODE_PROXY_PATH =
  '/fog-communication-manager/api-node/request';

export function registerBodyParsers(app: INestApplication): void {
  app.use(API_NODE_PROXY_PATH, bodyParser.json({ limit: '64kb' }));
  app.use(bodyParser.json({ limit: '1000mb' }));
  app.use(bodyParser.urlencoded({ limit: '1000mb', extended: true }));
}
