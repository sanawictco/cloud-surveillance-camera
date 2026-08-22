import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrConfigs } from 'src/modules/videoDevices/domain/nvr/nvr.type';

export class SoftDeleteMultiCamerastWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.CONFIG,
    public data: {
      cameraIds: string[];
    },
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: {
      configType: NvrConfigs.SOFT_DELETE_MULTI_CAMERAS;
      msgId: string;
    },
  ) {}
}
