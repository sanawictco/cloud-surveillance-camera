import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { CameraWebSocketDataTypes } from 'src/modules/videoDevices/domain/camera/camera.type';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

export class ToConnectingCameraLiveSignalWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.DATA,
    public data: {
      id: string;
      liveSignalStatus: LiveSignalStatuses.CONNECTING;
    },
    public metadata: { dataType: CameraWebSocketDataTypes.LIVE_SIGNAL },
  ) {}
}
