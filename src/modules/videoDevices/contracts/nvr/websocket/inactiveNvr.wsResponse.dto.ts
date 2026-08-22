import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { NvrResponseDto } from '../http/response/nvr.response.dto';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { CameraResponseDto } from '../../camera/http/camera.response.dto';
import { NvrWebSocketConfigTypes } from 'src/modules/videoDevices/domain/nvr/nvr.type';

export class InActiveNvrWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.CONFIG,
    public data: {
      nvr: NvrResponseDto;
      cameras: CameraResponseDto[];
    },
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: {
      configType: NvrWebSocketConfigTypes.IN_ACTIVE;
      msgId: string;
    },
  ) {}
}
