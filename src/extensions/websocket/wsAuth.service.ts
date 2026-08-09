import { Injectable } from '@nestjs/common';
import axios from 'axios';
import AppConfig from 'configs/app.config';
import { Socket } from 'socket.io';
import { ServiceProvider } from '../serviceProvider/serviceProvider.service';
import { WsClientCachedModel } from './websocketClientCachedModel';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken');

@Injectable()
export class WsAuthService {
  constructor(private readonly serviceProvider: ServiceProvider) {}

  async validateWsClient(
    client: Socket,
  ): Promise<WsClientCachedModel | undefined> {
    const authorization = client?.handshake?.headers?.authorization;
    if (!authorization) return undefined;
    const result = await this.checkAccessTokenAsOnline(authorization);
    if (result.statusCode !== 200) return undefined;

    try {
      const accessToken = jwt.decode(authorization.split(' ').at(-1));
      const resourceAccess = accessToken?.resource_access;
      const clientAccess = resourceAccess?.[AppConfig().keycloak.clientId];
      if (!clientAccess) return undefined;
      return {
        id: accessToken.sub,
        phoneNumber: accessToken.preferred_username,
        name: accessToken.name,
        roles: clientAccess.roles ?? [],
        lang: accessToken.lang,
      };
    } catch (err) {
      this.serviceProvider.logger.error(
        'WS client token decode failed',
        err,
        WsAuthService.name,
      );
      return undefined;
    }
  }

  async checkAccessTokenAsOnline(accessToken: string) {
    try {
      const response = await axios.get(
        `${AppConfig().keycloak.authServer}/realms/${AppConfig().keycloak.realm}/protocol/openid-connect/userinfo`,
        {
          headers: {
            Authorization: accessToken,
          },
        },
      );
      return { statusCode: 200, data: response.data };
    } catch (err) {
      this.serviceProvider.logger.error(
        'WS access-token validation request failed',
        err instanceof Error ? err.message : String(err),
        WsAuthService.name,
      );
      return { statusCode: 400 };
    }
  }
}
