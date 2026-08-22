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
import type { UserInfoDto } from 'src/extensions/userInfo/userInfo.dto';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken') as { decode(token: string): unknown };

type AccessTokenPayload = {
  sub?: string;
  preferred_username?: string;
  name?: string;
  lang?: LanguageCode;
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
      const payload = jwt.decode(authorization.slice(7)) as
        | AccessTokenPayload
        | null;
      const roles = payload?.resource_access?.[AppConfig().keycloak.clientId]
        ?.roles;
      if (!payload?.sub || !Array.isArray(roles)) {
        throw new UnauthorizedException();
      }
      request.user = {
        id: payload.sub,
        phoneNumber: payload.preferred_username ?? '',
        name: payload.name ?? '',
        roles: roles as UserInfoDto['roles'],
        lang: payload.lang ?? LanguageCode.FA,
      };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
