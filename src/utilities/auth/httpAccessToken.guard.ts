import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import AppConfig from 'configs/app.config';
import type { Request } from 'express';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken') as { decode(token: string): unknown };

type AccessTokenPayload = {
  sub?: string;
  preferred_username?: string;
  name?: string;
  lang?: LanguageCode;
  aud?: string | string[];
  azp?: string;
  resource_access?: Record<string, { roles?: string[] }>;
};

@Injectable()
export class HttpAccessTokenGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }
    try {
      await axios.get(
        `${AppConfig().keycloak.authServer}/realms/${AppConfig().keycloak.realm}/protocol/openid-connect/userinfo`,
        { headers: { Authorization: authorization }, timeout: 5000 },
      );
      const payload = jwt.decode(
        authorization.slice(7),
      ) as AccessTokenPayload | null;
      if (!payload?.sub || !this.hasClientAccess(payload)) {
        throw new UnauthorizedException();
      }
      request.user = {
        id: payload.sub,
        phoneNumber: payload.preferred_username ?? '',
        name: payload.name ?? '',
        lang: payload.lang ?? LanguageCode.FA,
      };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private hasClientAccess(payload: AccessTokenPayload): boolean {
    const clientId = AppConfig().keycloak.clientId;
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    return (
      payload.resource_access?.[clientId] !== undefined ||
      audience.includes(clientId) ||
      payload.azp === clientId
    );
  }
}
