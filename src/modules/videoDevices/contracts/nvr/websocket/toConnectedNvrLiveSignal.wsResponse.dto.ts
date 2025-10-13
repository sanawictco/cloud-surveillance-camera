import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrWebSocketDataTypes } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

export class ToConnectedNvrLiveSignalWsResponseDto
  implements WebsocketMsgBaseDto
{
  type: WebSocketTypes.DATA;
  data: {
    id: string;
    liveSignalStatus: LiveSignalStatuses.CONNECTED;
  };
  metadata: { dataType: NvrWebSocketDataTypes.LIVE_SIGNAL };
}
