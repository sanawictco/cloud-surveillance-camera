import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { CameraResponseDto } from '../http/camera.response.dto';
import { CameraWebsocketConfigTypes } from 'src/modules/videoDevices/domain/camera/camera.type';

export class UpdateCameraWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.CONFIG,
    public data: CameraResponseDto & { cmdKey?: string },
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: {
      configType: CameraWebsocketConfigTypes.UPDATE;
      msgId: string;
    },
  ) {}
}
