import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { NvrResponseDto } from '../http/response/nvr.response.dto';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrWebSocketConfigTypes } from 'src/modules/videoDevices/domain/nvr/nvr.type';

export class ActiveNvrWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.CONFIG,
    public data: NvrResponseDto,
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: {
      configType: NvrWebSocketConfigTypes.ACTIVE;
      msgId: string;
    },
  ) {}
}
