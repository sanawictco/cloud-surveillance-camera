import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrWebSocketConfigTypes } from 'src/modules/videoDevices/domain/nvr/nvr.type';

export class DeleteNvrWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.CONFIG,
    public data: {
      id: string;
      softDeletedCameraIds: string[];
      pageIds: { widgets: string[]; liveDiagrams: string[] };
    },
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: {
      configType: NvrWebSocketConfigTypes.DELETE;
      msgId: string;
    },
  ) {}
}
