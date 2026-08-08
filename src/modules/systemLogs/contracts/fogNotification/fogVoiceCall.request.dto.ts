import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, Length, Validate } from 'class-validator';
import { AvoidUsingSpecialCharacters } from 'src/modules/shared/avoidUsingSpecialCharacters.validator';
import { AvoidUsingWhiteSpaceCharacters } from 'src/modules/shared/avoidUsingWhiteSpaceCharacters.validator';
import { NotificationLevel } from './notificationLevel.enum';

export class FogVoiceCallRequestDto {
  @ApiProperty()
  @IsString()
  @Length(8, 8)
  @Validate(AvoidUsingSpecialCharacters)
  @Validate(AvoidUsingWhiteSpaceCharacters)
  serialNumber!: string;

  @ApiProperty()
  @IsString()
  @Length(32, 32)
  @Validate(AvoidUsingSpecialCharacters)
  @Validate(AvoidUsingWhiteSpaceCharacters)
  accessToken!: string;

  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  message!: string;

  @ApiProperty()
  @IsEnum(NotificationLevel)
  level!: NotificationLevel;
}
