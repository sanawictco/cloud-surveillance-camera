import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { PageConfigs, PageWebsocketTypes } from '../domain/page.type';
import { PageResponseDto } from './page.response.dto';

export class UpdatePageWsResponseDto implements WebsocketMsgBaseDto {
  type: PageWebsocketTypes.CONFIG;
  data: PageResponseDto;
  message: string | { msgKey: string; msgParams?: string[] };
  metadata: { configType: PageConfigs.UPDATE_PAGE; msgId: string };
}
