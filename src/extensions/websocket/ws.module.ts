import { Logger, Module } from '@nestjs/common';
import { WebsocketService } from './websocket.service';
import { WsAuthService } from './wsAuth.service';

@Module({
  imports: [],
  providers: [WebsocketService, Logger, WsAuthService],
  exports: [WebsocketService],
})
export class WsModule {}
