import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { GatewayResponseDto } from '../http/response/gateway.response.dto';
import { AccessPointResponseDto } from '../../accessPoint/http/response/accessPoint.response.dto';
import { EndDeviceResponseDto } from '../../endDevice/http/response/endDevice.response.dto';
import { RuleChainDependencyProjection } from '../../ruleChainDependency.projection';
import { GatewayWebSocketConfigTypes } from 'src/modules/devices/domain/gateway/gateway.type';
import { DeviceWebSocketTypes } from 'src/modules/devices/shares/deviceWebsocketTypes.enum';

export class InActiveGatewayWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: DeviceWebSocketTypes.CONFIG,
    public data: {
      gateway: GatewayResponseDto;
      endDevices: EndDeviceResponseDto[];
      accessPoints: AccessPointResponseDto[];
      inactivatedRuleChains: RuleChainDependencyProjection[];
    },
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: {
      configType: GatewayWebSocketConfigTypes.IN_ACTIVE_GATEWAY;
      msgId: string;
    },
  ) {}
}
