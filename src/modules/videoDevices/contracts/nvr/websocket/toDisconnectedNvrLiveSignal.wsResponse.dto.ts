import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrWebSocketDataTypes } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

export class ToDisconnectedNvrLiveSignalWsResponseDto implements WebsocketMsgBaseDto {
  type: WebSocketTypes.DATA;
  data: {
    id: string;
    liveSignalStatus: LiveSignalStatuses.DIS_CONNECTED;
  };
  metadata: { dataType: NvrWebSocketDataTypes.LIVE_SIGNAL };

  constructor(props: ToDisconnectedNvrLiveSignalWsResponseDto) {
    this.type = props.type;
    this.data = props.data;
    this.metadata = props.metadata;
  }
}
