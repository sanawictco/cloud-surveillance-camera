import { AggregateID } from 'src/dddLib/core';
import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { CameraResponseDto } from '../../camera/http/camera.response.dto';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrWebSocketConfigTypes } from 'src/modules/videoDevices/domain/nvr/nvr.type';

export class AutoRegisterNvrWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.CONFIG,
    public data:
      | {
          id: AggregateID;
        }
      | {
          nvrId: AggregateID;
          addedCameras: CameraResponseDto[];
          deletedCameras: CameraResponseDto[];
        },
    public message?: string | { msgKey: string; msgParams?: string[] },
    public metadata?: {
      configType: NvrWebSocketConfigTypes.REGISTER;
      msgId: string;
    },
  ) {}
}
