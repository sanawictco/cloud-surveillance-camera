import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { GatewayWebSocketConfigTypes } from 'src/modules/devices/domain/gateway/gateway.type';
import { DeviceWebSocketTypes } from 'src/modules/devices/shares/deviceWebsocketTypes.enum';
import { GatewayResponseDto } from '../http/response/gateway.response.dto';

export class UpdateGatewayWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: DeviceWebSocketTypes.CONFIG,
    public data: GatewayResponseDto,
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: {
      configType: GatewayWebSocketConfigTypes.UPDATE_GATEWAY;
      msgId: string;
    },
  ) {}
}
