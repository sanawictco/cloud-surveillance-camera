import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrConfigs } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { CameraResponseDto } from '../../camera/http/camera.response.dto';

export class ActiveMultiCamerastWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.CONFIG,
    public data: CameraResponseDto[],
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: {
      configType: NvrConfigs.ACTIVE_MULTI_CAMERAS;
      msgId: string;
    },
  ) {}
}
