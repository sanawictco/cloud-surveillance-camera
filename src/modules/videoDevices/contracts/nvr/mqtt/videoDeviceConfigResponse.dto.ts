import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsMACAddress,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class NvrSearchMqttResponseDto {
  @IsString()
  @Length(1, 128)
  msgId!: string;

  @IsArray()
  @ArrayMaxSize(4096)
  @ArrayUnique()
  @IsMACAddress({ each: true })
  macAddresses!: string[];
}

export class NvrLiveSignalMqttResponseDto {
  @IsString()
  @Length(1, 128)
  msgId!: string;

  @IsArray()
  @ArrayMaxSize(4096)
  @ArrayUnique()
  @IsMACAddress({ each: true })
  disconnectedMacAddresses!: string[];
}

export class NvrRegisterMqttResponseDto {
  @IsString()
  @Length(1, 128)
  msgId!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Length(8, 8, { each: true })
  @Matches(/^[A-Z0-9]{8}$/, { each: true })
  unRegisteredCameraSerialNumbers!: string[];
}

export class NvrLifecycleMqttResponseDto {
  @IsString()
  @Length(1, 128)
  msgId!: string;
}
