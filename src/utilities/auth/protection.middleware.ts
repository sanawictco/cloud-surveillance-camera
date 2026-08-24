import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import AppConfig from 'configs/app.config';
import { NextFunction, Request, Response } from 'express';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const qs = require('qs');

@Injectable()
export class ProtectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ProtectionMiddleware.name);
  constructor(private readonly serviceProvider: ServiceProvider) {}
  async use(request: Request, response: Response, next: NextFunction) {
    try {
      const { headers, cookies } = request;

      if (!headers.authorization) {
        return await this._handleMissingAuthorization(cookies, response);
      }

      return await this._handleAuthorizationHeader(
        request,
        response,
        next,
        cookies,
      );
    } catch (err) {
      console.log('protection error => ', err);
      return response.status(403).json('forbidden');
    }
  }

  private async _handleMissingAuthorization(
    cookies: any,
    response: Response,
  ): Promise<Response> {
    if (!cookies?.refreshToken) {
      return response.status(401).json('not authorized2');
    }

    return this._handleRefreshToken(cookies.refreshToken, response);
  }

  private async _handleAuthorizationHeader(
    request: Request,
    response: Response,
    next: NextFunction,
    cookies: any,
  ): Promise<Response | void> {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return response.status(401).json('not authorized4');
    }

    const accessTokenValidityResult =
      await this._checkAccessTokenAsOnline(authorization);

    if (accessTokenValidityResult.statusCode === 200) {
      return this._handleValidAccessToken(request, response, next);
    }

    if (cookies?.refreshToken) {
      return this._handleRefreshToken(cookies.refreshToken, response);
    }

    return response.status(401).json('not authorized4');
  }

  private _handleValidAccessToken(
    request: Request,
    response: Response,
    next: NextFunction,
  ): void | Response {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return response.status(401).json('not authorized');
    }

    const token = authorization.split(' ').at(-1);

    if (!token) {
      return response.status(401).json('not authorized');
    }

    const accessToken = this._decodeAccessToken(token);

    if (!this._hasRequiredClientAccess(accessToken.resource_access)) {
      return response.status(403).json('forbidden');
    }

    request.user = this._buildUserFromToken(accessToken);
    return next();
  }

  private async _handleRefreshToken(
    refreshToken: string,
    response: Response,
  ): Promise<Response> {
    const checkRefreshToken =
      await this._checkRefreshTokenValidity(refreshToken);

    if (checkRefreshToken.statusCode !== 200) {
      return response.status(401).json('not authorized');
    }

    const decodedAccessToken = this._decodeAccessToken(
      checkRefreshToken.data.access_token,
    );

    if (!this._hasRequiredClientAccess(decodedAccessToken.resource_access)) {
      return response.status(403).json('forbidden');
    }

    this._setRefreshTokenCookie(
      response,
      checkRefreshToken.data.refresh_token,
      checkRefreshToken.data.refresh_expires_in,
    );

    const { sub } = this._decodeAccessToken(
      checkRefreshToken.data.refresh_token,
    );

    return response.status(206).json({
      access_token: checkRefreshToken.data.access_token,
      id: sub,
    });
  }

  private _decodeAccessToken(token: string): any {
    return jwt.decode(token);
  }

  private _hasRequiredClientAccess(resourceAccess: any): boolean {
    const clientId = AppConfig().keycloak.clientId;
    return !!resourceAccess?.[clientId];
  }

  private _buildUserFromToken(accessToken: any) {
    const clientId = AppConfig().keycloak.clientId;

    return {
      id: accessToken.sub,
      phoneNumber: accessToken.preferred_username,
      name: accessToken.name,
      roles: accessToken.resource_access[clientId].roles,
      lang: accessToken.lang,
    };
  }

  private _setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
    expiresInSeconds: number,
  ): void {
    const expires = this._calculateCookieExpiration(expiresInSeconds);

    response.cookie('refreshToken', refreshToken, {
      domain: '.sanawict.ir',
      expires,
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  private _calculateCookieExpiration(expiresInSeconds: number): Date {
    const expires = new Date();
    expires.setMilliseconds(
      expires.getMilliseconds() + expiresInSeconds * 1000,
    );
    return expires;
  }

  async _checkRefreshTokenValidity(refreshToken: string): Promise<{
    statusCode: number;
    data?: any;
  }> {
    const tokenData = this._buildRefreshTokenRequestData(refreshToken);
    const config = this._buildTokenRequestConfig(tokenData);

    try {
      const response = await this.serviceProvider.httpService.request(config);
      return { statusCode: 200, data: response.data };
    } catch (err: any) {
      // Surface WHY Keycloak rejected the refresh — without this the caller
      // collapses to a bare 401 with no signal. HttpService._handleError enriches
      // the error: `statusCode` + `data` ({error,error_description}, e.g.
      // invalid_client / invalid_grant) on an HTTP response, or `code`
      // (ECONNREFUSED / EAI_AGAIN / ETIMEDOUT) when Keycloak is unreachable.
      this.logger.warn(
        `refresh-token exchange failed [${err?.statusCode ?? err?.code ?? 'unknown'}]: ${JSON.stringify(
          err?.data ?? err?.message ?? '',
        )}`,
      );
      return { statusCode: 400 };
    }
  }

  async _checkAccessTokenAsOnline(accessToken: string): Promise<{
    statusCode: number;
    data?: any;
  }> {
    const config = this._buildUserInfoRequestConfig(accessToken);

    try {
      const response = await this.serviceProvider.httpService.request(config);
      return { statusCode: 200, data: response.data };
    } catch (err: any) {
      // Expected whenever the access token is expired/invalid (the caller then
      // falls back to the refresh flow), so debug-level to avoid noise.
      this.logger.debug(
        `access-token userinfo check failed [${err?.statusCode ?? err?.code ?? 'unknown'}]`,
      );
      return { statusCode: 400 };
    }
  }

  private _buildRefreshTokenRequestData(refreshToken: string): string {
    return qs.stringify({
      grant_type: 'refresh_token',
      client_id: AppConfig().keycloak.authClientId,
      client_secret: AppConfig().keycloak.authClientSecret,
      refresh_token: refreshToken,
    });
  }

  private _buildTokenRequestConfig(data: string) {
    const keycloakConfig = AppConfig().keycloak;

    return {
      method: 'post',
      url: `${keycloakConfig.authServer}/realms/${keycloakConfig.realm}/protocol/openid-connect/token`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    };
  }

  private _buildUserInfoRequestConfig(accessToken: string) {
    const keycloakConfig = AppConfig().keycloak;

    return {
      method: 'get',
      url: `${keycloakConfig.authServer}/realms/${keycloakConfig.realm}/protocol/openid-connect/userinfo`,
      headers: {
        Authorization: accessToken,
      },
    };
  }
}
