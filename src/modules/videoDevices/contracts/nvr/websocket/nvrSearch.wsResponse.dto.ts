import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrWebSocketConfigTypes } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import {
  AutoSearchRecognizeDeviceDto,
  FinalAutoSearchResult,
} from '../dtos/autoSearchDevices.dto';

export class NvrSearchWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: WebSocketTypes.CONFIG,
    public data: {
      nvrId: string;
      videoDevices?: FinalAutoSearchResult | AutoSearchRecognizeDeviceDto[];
    },
    public message?: string | { msgKey: string; msgParams?: string[] },
    public metadata?: {
      configType: NvrWebSocketConfigTypes.SEARCH;
      msgId: string;
    },
  ) {}
}
