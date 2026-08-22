import { AggregateID } from 'src/dddLib/core';
import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrWebSocketConfigTypes } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { SanitizedNvrCameraDto } from '../dtos/autoSearchDevices.dto';

export class RegisterNvrWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.CONFIG,
    public data:
      | {
          id: AggregateID;
        }
      | {
          nvrId: AggregateID;
          addedCameras: SanitizedNvrCameraDto[];
          deletedCameras: SanitizedNvrCameraDto[];
          unRegisteredCameraSerialNumbers: string[];
        },
    public message?: string | { msgKey: string; msgParams?: string[] },
    public metadata?: {
      configType: NvrWebSocketConfigTypes.REGISTER;
      msgId: string;
    },
  ) {}
}
