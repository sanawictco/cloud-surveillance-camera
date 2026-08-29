import { Module } from '@nestjs/common';
import { WebsocketService } from './websocket.service';
import { WsAuthService } from './wsAuth.service';
import { TenantAccessModule } from 'src/modules/tenantAccess/tenantAccess.module';

@Module({
  imports: [TenantAccessModule],
  providers: [WebsocketService, WsAuthService],
  exports: [WebsocketService],
})
export class WsModule {}
