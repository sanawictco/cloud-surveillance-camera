import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { CameraWebSocketDataTypes } from '../../../domain/camera/camera.type';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

export class ToDisconnectedCameraLiveSignalWsResponseDto implements WebsocketMsgBaseDto {
  type: WebSocketTypes.DATA;
  data: {
    id: string;
    liveSignalStatus: LiveSignalStatuses.DIS_CONNECTED;
  };
  metadata: { dataType: CameraWebSocketDataTypes.LIVE_SIGNAL };

  constructor(props: ToDisconnectedCameraLiveSignalWsResponseDto) {
    this.type = props.type;
    this.data = props.data;
    this.metadata = props.metadata;
  }
}
