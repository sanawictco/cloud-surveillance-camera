import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrWebSocketDataTypes } from 'src/modules/videoDevices/domain/nvr/nvr.type';

export class CloudIsRecoveringWsResponseDto implements WebsocketMsgBaseDto {
  type: WebSocketTypes.DATA;
  data: {
    id: string;
    cloudIsRecovering: boolean;
  };
  metadata: {
    dataType: NvrWebSocketDataTypes.CLOUD_IS_RECOVERING;
  };

  constructor(props: CloudIsRecoveringWsResponseDto) {
    this.type = props.type;
    this.data = props.data;
    this.metadata = props.metadata;
  }
}
