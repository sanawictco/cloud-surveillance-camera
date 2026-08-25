import { IsIn, IsString, Length } from 'class-validator';
import { IsDeviceMsgId } from 'src/dddLib/utils/isDeviceMsgId.validator';

export class FogVideoDeviceConfigRequestDto {
  @IsString()
  @Length(8, 8)
  serialNumber!: string;

  @IsString()
  @Length(32, 32)
  accessToken!: string;

  @IsDeviceMsgId()
  msgId!: string;

  @IsIn(['videoDevice', 'page'])
  configType!: 'videoDevice' | 'page';
}
