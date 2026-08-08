import { Injectable } from '@nestjs/common';
import AppConfig from 'configs/app.config';
import { Socket } from 'socket.io';
import axios from 'axios';
import { WsClientCachedModel } from './websocketClientCachedModel';
import { CacheService } from '../caching/cache.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken');

@Injectable()
export class WsAuthService {
  constructor(_cache: CacheService<WsClientCachedModel>) {}

  async validateWsClient(
    client: Socket,
  ): Promise<WsClientCachedModel | undefined> {
    if (!client?.handshake?.headers?.authorization) return;
    const authorization: string = client?.handshake?.headers?.authorization;
    const result: any = await this.checkAccessTokenAsOnline(authorization);
    if (result.statusCode === 200) {
      const accessToken = jwt.decode(authorization.split(' ').slice(-1)[0]);
      const { resource_access } = accessToken;
      if (!resource_access[`${AppConfig().keycloak.clientId}`]) return;
      const userInfo = {
        id: accessToken.sub,
        phoneNumber: accessToken.preferred_username,
        name: accessToken.name,
        roles: resource_access[`${AppConfig().keycloak.clientId}`].roles,
        lang: accessToken.lang,
      };
      return userInfo;
    }
    return;
  }
  async checkAccessTokenAsOnline(accessToken: string) {
    const config = {
      method: 'get',
      url: `${AppConfig().keycloak.authServer}/realms/${AppConfig().keycloak.realm}/protocol/openid-connect/userinfo`,
      headers: {
        Authorization: accessToken,
      },
    };

    const result = new Promise((resolve) => {
      axios(config)
        .then((response) => {
          resolve({ statusCode: 200, data: response.data });
        })
        .catch(() => {
          resolve({ statusCode: 400 });
        });
    });
    return result;
  }
}
