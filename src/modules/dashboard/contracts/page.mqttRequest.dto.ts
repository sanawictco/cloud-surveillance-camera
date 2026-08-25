import { IsDeviceMsgId } from 'src/dddLib/utils/isDeviceMsgId.validator';

export class PageMqttRequestDto {
  @IsDeviceMsgId()
  msgId!: string;
}
