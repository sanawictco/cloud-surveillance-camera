import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { PageConfigs, PageWebsocketTypes } from '../domain/page.type';
import { PageResponseDto } from './page.response.dto';

export class CreatePageWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: PageWebsocketTypes.CONFIG,
    public data: PageResponseDto,
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: { configType: PageConfigs.CREATE_PAGE; msgId: string },
  ) {}
}
