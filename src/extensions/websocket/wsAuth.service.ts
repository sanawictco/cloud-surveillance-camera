import { Injectable } from '@nestjs/common';
import axios from 'axios';
import AppConfig from 'configs/app.config';
import { Socket } from 'socket.io';
import { ServiceProvider } from '../serviceProvider/serviceProvider.service';
import { WsClientCachedModel } from './websocketClientCachedModel';
import { TenantAccessService } from 'src/modules/tenantAccess/applicationService/tenantAccess.service';
import { isUUID } from 'class-validator';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken');

@Injectable()
export class WsAuthService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly tenantAccessService: TenantAccessService,
  ) {}

  async validateWsClient(
    client: Socket,
  ): Promise<WsClientCachedModel | undefined> {
    const authorization = client?.handshake?.headers?.authorization;
    const tenantId = client?.handshake?.auth?.tenantId;
    if (
      !authorization ||
      typeof tenantId !== 'string' ||
      !isUUID(tenantId, '4')
    ) {
      return undefined;
    }
    const result = await this.checkAccessTokenAsOnline(authorization);
    if (result.statusCode !== 200) return undefined;

    try {
      const accessToken = jwt.decode(authorization.split(' ').at(-1));
      const clientAccess =
        accessToken?.resource_access?.[AppConfig().keycloak.clientId];
      if (!accessToken?.sub || !clientAccess) return undefined;
      const tenantAccess = await this.tenantAccessService.resolveActiveAccess(
        tenantId,
        accessToken.sub,
      );
      if (!tenantAccess) return undefined;
      return {
        id: accessToken.sub,
        tenantId,
        phoneNumber: accessToken.preferred_username,
        name: accessToken.name,
        roles: tenantAccess.roles,
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
