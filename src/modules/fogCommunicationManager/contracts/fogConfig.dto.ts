import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  Length,
  Max,
  Min,
  Validate,
} from 'class-validator';
import { AvoidUsingSpecialCharacters } from 'src/shared/avoidUsingSpecialCharacters.validator';
import { AvoidUsingWhiteSpaceCharacters } from 'src/shared/avoidUsingWhiteSpaceCharacters.validator';
enum ConfigTypeEnum {
  DEVICE = 'videoDevice',
  PAGE = 'page',
}
export class FogConfigReqDto {
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
  @IsInt()
  @Min(0)
  @Max(65535)
  msgId!: number;

  @ApiProperty({
    enum: ConfigTypeEnum,
    enumName: 'ConfigTypeEnum',
  })
  @IsEnum(ConfigTypeEnum)
  configType!: ConfigTypeEnum;
}
