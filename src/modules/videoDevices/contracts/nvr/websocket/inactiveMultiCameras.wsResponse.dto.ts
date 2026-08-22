import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrConfigs } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { CameraResponseDto } from '../../camera/http/camera.response.dto';
import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';

export class InActiveMultiCamerastWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.CONFIG,
    public data: {
      cameras: CameraResponseDto[];
    },
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: {
      configType: NvrConfigs.IN_ACTIVE_MULTI_CAMERAS;
      msgId: string;
    },
  ) {}
}
