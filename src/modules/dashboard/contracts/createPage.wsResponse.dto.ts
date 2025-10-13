import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { PageConfigs, PageWebsocketTypes } from '../domain/page.type';
import { PageResponseDto } from './page.response.dto';

export class CreatePageWsResponseDto implements WebsocketMsgBaseDto {
  type: PageWebsocketTypes.CONFIG;
  data: PageResponseDto;
  message: string | { msgKey: string; msgParams?: string[] };
  metadata: { configType: PageConfigs.CREATE_PAGE; msgId: string };
}
