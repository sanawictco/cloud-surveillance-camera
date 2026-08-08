import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from './wsAuth.service';
import { ServiceProvider } from '../serviceProvider/serviceProvider.service';
import { CacheService } from '../caching/cache.service';
import { WsClientCachedModel } from './websocketClientCachedModel';
import { Exact, WsRespnoseTypes } from './wsResponse.types.dto';
import AppConfig from 'configs/app.config';

enum WsChannels {
  DEVICES_SOCKET = 'DevicesSocket',
  RULE_CHAINS_SOCKET = 'RuleChainsSocket',
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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly cache: CacheService<WsClientCachedModel>,
    private readonly serviceProvider: ServiceProvider,
    private readonly wsAuthService: WsAuthService,
  ) {}
  public readonly channels = WsChannels;
  @WebSocketServer()
  private server!: Server;

  async handleDisconnect(client: Socket) {
    // room deleted automatically when it has no active user
    client.leave(client.id);
    await this.cache.delete(client.id);
    this.serviceProvider.logger.log(
      `socketId= ${client.id} disconnected`,
      WebsocketService.name,
    );
  }

  async handleConnection(client: Socket) {
    const userInfo = await this.wsAuthService.validateWsClient(client);
    if (!userInfo) {
      client.disconnect();
      return;
    }
    // create room
    client.join(client.id);
    await this.cache.set(client.id, userInfo);
    this.serviceProvider.logger.log(
      `socketId= ${client.id} connected`,
      WebsocketService.name,
    );
  }

  afterInit() {
    this.serviceProvider.logger.log(
      'websocket initialized...',
      WebsocketService.name,
    );
  }

  async sendMessage<T>(
    channel: WsChannels,
    _wsMessage: Exact<WsRespnoseTypes, T>,
  ) {
    setTimeout(
      async () => {
        const rooms = this.server.sockets.adapter.rooms.keys();
        const wsMessage: any = structuredClone(_wsMessage);
        let message = wsMessage.message || wsMessage.data.message;
        for (const room of rooms) {
          const cachedUserInfo: WsClientCachedModel | undefined =
            await this.cache.get(room);

          if (!cachedUserInfo) return;
          const { lang } = cachedUserInfo;
          if (message && typeof message !== 'string') {
            const { msgKey, msgParams } = message;
            if (msgParams) {
              message =
                this.serviceProvider.translatorService.translateByPattern(
                  msgKey,
                  msgParams,
                  lang,
                );
            } else {
              message = this.serviceProvider.translatorService.translateByName(
                msgKey,
                lang,
              );
            }
          }
          if (wsMessage.message) wsMessage.message = message; // for non systemlog messages
          if (wsMessage.data.message) wsMessage.data.message = message; // for systemlog messages

          // this.serviceProvider.logger.debug(
          //   'websocket data sent...',
          //   room,
          //   channel,
          //   wsMessage,
          // );
          this.server.to(room).emit(channel, wsMessage);
        }
      },
      AppConfig().environment === 'development' ? 500 : 0, // only for check loaders in fronend
    );
  }
}
