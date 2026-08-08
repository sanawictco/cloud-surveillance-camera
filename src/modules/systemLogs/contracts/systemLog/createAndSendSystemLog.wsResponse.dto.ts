import { WebsocketMsgBaseDto } from 'src/extensions/websocket/websocket.service';
import { SendSystemLogOnWebSocketProps } from '../../domain/systemLog.type';
import { SystemLogWebSocketTypes } from '../../shares/systemLogWebSocketTypes.enum';

export class CreateAndSendSystemLogWsResponseDto implements WebsocketMsgBaseDto {
  constructor(
    public type: SystemLogWebSocketTypes,
    public data: SendSystemLogOnWebSocketProps,
    public metadata: {
      configType?: string;
      dataType?: string;
      widget?: { id: string };
      cmdKey?: string;
    },
  ) {}
}
