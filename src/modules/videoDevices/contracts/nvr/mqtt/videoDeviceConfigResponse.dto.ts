import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsMACAddress,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { AggregateID } from 'src/dddLib/core';
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
  failedRegisteredCameraSerialNumbers!: string[];

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  failedDeletedCameraSerialNumbers!: AggregateID[];
}

export class NvrActiveMultiCamerasMqttResponseDto {
  @IsDeviceMsgId()
  msgId!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  failedActivatedCameraIds!: AggregateID[];
}

export class NvrInactiveMultiCamerasMqttResponseDto {
  @IsDeviceMsgId()
  msgId!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  failedInactivatedCameraIds!: AggregateID[];
}

export class NvrSoftDeleteMultiCamerasMqttResponseDto {
  @IsDeviceMsgId()
  msgId!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  failedDeletedCameraIds!: AggregateID[];
}

export class NvrLifecycleMqttResponseDto {
  @IsDeviceMsgId()
  msgId!: string;
}
