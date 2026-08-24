import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  Length,
  Validate,
} from 'class-validator';
import { AvoidUsingSpecialCharacters } from '../../../shared/avoidUsingSpecialCharacters.validator';
import { AvoidUsingWhiteSpaceCharacters } from '../../../shared/avoidUsingWhiteSpaceCharacters.validator';

export class RestoreDataAndStateOfFogRequestDto {
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
  @IsString()
  superTableName!: string;

  @ApiProperty()
  @IsObject()
  @IsOptional()
  data!: any;
}
