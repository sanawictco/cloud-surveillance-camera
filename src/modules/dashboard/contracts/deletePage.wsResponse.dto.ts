import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { PageConfigs, PageWebsocketTypes } from '../domain/page.type';

export class DeletePageWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: PageWebsocketTypes.CONFIG,
    public data: { id: string },
    public message: string | { msgKey: string; msgParams?: string[] },
    public metadata: { configType: PageConfigs.DELETE_PAGE; msgId: string },
  ) {}
}
