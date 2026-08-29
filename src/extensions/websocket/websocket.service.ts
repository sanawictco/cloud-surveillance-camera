import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import AppConfig from 'configs/app.config';
import { Server, Socket } from 'socket.io';
import { CacheService } from '../caching/cache.service';
import { ServiceProvider } from '../serviceProvider/serviceProvider.service';
import {
  IShutdownHandler,
  ShutdownOrchestratorService,
} from '../shutdown/shutdown.service';
import { WsAuthService } from './wsAuth.service';
import { WsClientCachedModel } from './websocketClientCachedModel';
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

@WebSocketGateway({
  cors: {
    origin: '*',
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

  sendMessage<T extends WebsocketMsgBaseDto>(
    channel: WsChannels,
    _wsMessage: T,
  ): void {
    setTimeout(
      async () => {
        if (this._isShutDown) return;
        try {
          const rooms = [...this.server.sockets.adapter.rooms.keys()];
          const wsMessage: any = structuredClone(_wsMessage);
          const originalMessage = wsMessage.message ?? wsMessage.data?.message;
          const tenantId = wsMessage.tenantId ?? wsMessage.data?.tenantId;
          if (channel === WsChannels.SYSTEM_LOGS_SOCKET && !tenantId) {
            throw new Error('system log WebSocket message requires tenantId');
          }
          const cachedUsers = await this.cache.getMany(rooms);

          for (const room of rooms) {
            const cachedUserInfo = cachedUsers.get(room);
            if (!cachedUserInfo) continue;
            if (tenantId && cachedUserInfo.tenantId !== tenantId) continue;
            if (channel === WsChannels.SYSTEM_LOGS_SOCKET) {
              const access = await this.tenantAccessService.resolveActiveAccess(
                tenantId,
                cachedUserInfo.id,
              );
              if (!access) {
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
            this.server.to(room).emit(channel, wsMessage);
          }
        } catch (err) {
          this.serviceProvider.logger.error(
            `websocket sendMessage failed for channel ${channel}`,
            err,
            WebsocketService.name,
          );
        }
      },
      AppConfig().environment === 'development' ? 500 : 0,
    );
  }
}
