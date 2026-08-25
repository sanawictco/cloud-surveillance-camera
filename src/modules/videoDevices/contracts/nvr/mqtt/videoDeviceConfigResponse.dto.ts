import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsMACAddress,
  Length,
  Matches,
} from 'class-validator';
import { IsDeviceMsgId } from 'src/dddLib/utils/isDeviceMsgId.validator';

export class NvrSearchMqttResponseDto {
  @IsDeviceMsgId()
  msgId!: string;

  @IsArray()
  @ArrayMaxSize(4096)
  @ArrayUnique()
  @IsMACAddress({ each: true })
  macAddresses!: string[];
}

export class NvrLiveSignalMqttResponseDto {
  @IsDeviceMsgId()
  msgId!: string;

  @IsArray()
  @ArrayMaxSize(4096)
  @ArrayUnique()
  @IsMACAddress({ each: true })
  disconnectedMacAddresses!: string[];
}

export class NvrRegisterMqttResponseDto {
  @IsDeviceMsgId()
  msgId!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Length(8, 8, { each: true })
  @Matches(/^[A-Z0-9]{8}$/, { each: true })
  unRegisteredCameraSerialNumbers!: string[];
}

export class NvrLifecycleMqttResponseDto {
  @IsDeviceMsgId()
  msgId!: string;
}
