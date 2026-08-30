import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import AppConfig from 'configs/app.config';
import { isUUID } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { CacheService } from '../caching/cache.service';
import { ServiceProvider } from '../serviceProvider/serviceProvider.service';
import {
  IShutdownHandler,
  ShutdownOrchestratorService,
} from '../shutdown/shutdown.service';
import { WsAuthService } from './wsAuth.service';
import { WsClientCachedModel } from './websocketClientCachedModel';
import { tenantRoomName } from './tenantRooms';
import { TenantAccessService } from 'src/modules/tenantAccess/applicationService/tenantAccess.service';

enum WsChannels {
  VIDEO_DEVICES_SOCKET = 'VIDEO_DevicesSocket',
  SYSTEM_LOGS_SOCKET = 'SystemLogsSocket',
  PAGES_SOCKET = 'PagesSocket',
  ERRORS_SOCKET = 'ErrorsSocket',
}

export interface WebsocketMsgBaseDto {
  type: string;
  data: object;
  message?: string | { msgKey: string; msgParams?: string[] };
  metadata?: object;
}

// @WebSocketGateway options are static, so the origin is resolved once at
// module load. The guarded read keeps unit suites that import this module
// without a full environment from crashing; production still fails fast on a
// missing CORS_ORIGINS through the strict read in main.ts, which shares this
// allowlist.
function wsCorsOrigin(): string[] | boolean {
  try {
    const config = AppConfig();
    if (config.environment === 'production') {
      // Required in production; the strict read in main.ts fails startup
      // earlier if it is absent.
      return config.cors.allowedOrigins!;
    }
  } catch {
    // fall through to the non-production default
  }
  return true;
}

@WebSocketGateway({
  cors: {
    origin: wsCorsOrigin(),
  },
})
export class WebsocketService
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy,
    IShutdownHandler
{
  constructor(
    private readonly cache: CacheService<WsClientCachedModel>,
    private readonly serviceProvider: ServiceProvider,
    private readonly wsAuthService: WsAuthService,
    private readonly shutdownOrchestrator: ShutdownOrchestratorService,
    private readonly tenantAccessService: TenantAccessService,
  ) {}

  public readonly channels = WsChannels;

  @WebSocketServer()
  private readonly server!: Server;

  private _isShutDown = false;

  async onModuleInit(): Promise<void> {
    this.shutdownOrchestrator.registerHandler('WebSocket', this);
  }

  async shutdown(): Promise<void> {
    if (this._isShutDown) return;
    this._isShutDown = true;
    if (!this.server) return;

    this.server.emit('server:shutdown', {
      message: 'Server is restarting. Please reconnect in a moment.',
    });
    this.server.disconnectSockets(true);

    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    this.serviceProvider.logger.log('WebSocket server closed gracefully');
  }

  async onModuleDestroy(): Promise<void> {
    if (this._isShutDown) return;
    if (this.shutdownOrchestrator.isShuttingDown) return;
    await this.shutdown();
  }

  async handleDisconnect(client: Socket) {
    client.leave(client.id);
    await this.cache.delete(client.id);
    this.serviceProvider.logger.log(
      `socketId= ${client.id} disconnected`,
      WebsocketService.name,
    );
  }

  async handleConnection(client: Socket) {
    const userInfo = await this.wsAuthService.validateWsClient(client);
    if (!userInfo) return client.disconnect();
    client.join(client.id);
    client.join(tenantRoomName(userInfo.tenantId));
    await this.cache.set(client.id, userInfo);
    this.serviceProvider.logger.log(
      `socketId= ${client.id} connected`,
      WebsocketService.name,
    );
    return undefined;
  }

  afterInit() {
    this.serviceProvider.logger.log(
      'websocket initialized...',
      WebsocketService.name,
    );
  }

  sendTenantMessage<T extends WebsocketMsgBaseDto>(
    tenantId: string,
    channel: WsChannels,
    _wsMessage: T,
  ): void {
    // Fail closed without throwing: callers may invoke this from detached
    // timers, where a synchronous throw would surface as an unhandled
    // rejection. A business event is never delivered without a verified tenant
    // target.
    if (!isUUID(tenantId, '4')) {
      this.serviceProvider.logger.error(
        `websocket send rejected: tenantId missing or invalid for channel ${channel}`,
        WebsocketService.name,
      );
      return;
    }
    const room = tenantRoomName(tenantId);
    setTimeout(
      async () => {
        if (this._isShutDown) return;
        try {
          const socketIds = [
            ...(this.server.sockets.adapter.rooms.get(room) ?? []),
          ];
          if (socketIds.length === 0) return;
          const wsMessage: any = structuredClone(_wsMessage);
          const originalMessage = wsMessage.message ?? wsMessage.data?.message;
          const cachedUsers = await this.cache.getMany(socketIds);

          for (const socketId of socketIds) {
            const cachedUserInfo = cachedUsers.get(socketId);
            if (!cachedUserInfo) continue;
            if (cachedUserInfo.tenantId !== tenantId) continue;
            if (channel === WsChannels.SYSTEM_LOGS_SOCKET) {
              const access = await this.tenantAccessService.resolveActiveAccess(
                tenantId,
                cachedUserInfo.id,
              );
              if (!access) {
                // Membership was revoked or the tenant was suspended after the
                // socket connected: drop it instead of leaving a live channel.
                this.server.sockets.sockets.get(socketId)?.disconnect(true);
                continue;
              }
            }

            let message = originalMessage;
            if (message && typeof message !== 'string') {
              const { msgKey, msgParams } = message;
              message = msgParams
                ? this.serviceProvider.translatorService.translateByPattern(
                    msgKey,
                    msgParams,
                    cachedUserInfo.lang,
                  )
                : this.serviceProvider.translatorService.translateByName(
                    msgKey,
                    cachedUserInfo.lang,
                  );
            }

            if (wsMessage.message) wsMessage.message = message;
            if (wsMessage.data?.message) wsMessage.data.message = message;
            this.server.to(socketId).emit(channel, wsMessage);
          }
        } catch (err) {
          this.serviceProvider.logger.error(
            `websocket sendTenantMessage failed for tenant ${tenantId} channel ${channel}`,
            err,
            WebsocketService.name,
          );
        }
      },
      AppConfig().environment === 'development' ? 500 : 0,
    );
  }

  /**
   * Platform/lifecycle operation: force-disconnect every socket of one tenant,
   * used when the tenant or its members must lose access immediately. It is
   * separately named and must not be reached by normal business senders.
   */
  disconnectTenantSockets(tenantId: string): number {
    if (!isUUID(tenantId, '4')) return 0;
    const room = this.server?.sockets?.adapter?.rooms?.get(
      tenantRoomName(tenantId),
    );
    if (!room) return 0;
    let disconnected = 0;
    for (const socketId of room) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) continue;
      socket.disconnect(true);
      disconnected++;
    }
    this.serviceProvider.logger.log(
      `tenantId= ${tenantId} force-disconnected ${disconnected} socket(s)`,
      WebsocketService.name,
    );
    return disconnected;
  }
}
