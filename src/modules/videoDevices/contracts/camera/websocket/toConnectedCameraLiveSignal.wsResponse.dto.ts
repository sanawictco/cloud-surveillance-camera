import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { CameraWebSocketDataTypes } from '../../../domain/camera/camera.type';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

export class ToConnectedCameraLiveSignalWsResponseDto implements WebsocketMsgBaseDto {
  type: WebSocketTypes.DATA;
  data: {
    id: string;
    liveSignalStatus: LiveSignalStatuses.CONNECTED;
  };
  metadata: { dataType: CameraWebSocketDataTypes.LIVE_SIGNAL };

  constructor(props: ToConnectedCameraLiveSignalWsResponseDto) {
    this.type = props.type;
    this.data = props.data;
    this.metadata = props.metadata;
  }
}
