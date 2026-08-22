import { IsIn, IsString, Length } from 'class-validator';

export class FogVideoDeviceConfigRequestDto {
  @IsString()
  @Length(8, 8)
  serialNumber!: string;

  @IsString()
  @Length(32, 32)
  accessToken!: string;

  @IsString()
  @Length(1, 128)
  msgId!: string;

  @IsIn(['videoDevice'])
  configType!: 'videoDevice';
}
