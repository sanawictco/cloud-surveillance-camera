import { Module } from '@nestjs/common';
import { WebsocketService } from './websocket.service';
import { WsAuthService } from './wsAuth.service';

@Module({
  imports: [],
  providers: [WebsocketService, WsAuthService],
  exports: [WebsocketService],
})
export class WsModule {}
