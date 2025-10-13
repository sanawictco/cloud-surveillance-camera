import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { PageConfigs, PageWebsocketTypes } from '../domain/page.type';

export class DeletePageWsResponseDto implements WebsocketMsgBaseDto {
  type: PageWebsocketTypes.CONFIG;
  data: { id: string };
  message: string | { msgKey: string; msgParams?: string[] };
  metadata: { configType: PageConfigs.DELETE_PAGE; msgId: string };
}
