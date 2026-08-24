import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Validate } from 'class-validator';
import { AvoidUsingSpecialCharacters } from 'src/shared/avoidUsingSpecialCharacters.validator';
import { AvoidUsingWhiteSpaceCharacters } from 'src/shared/avoidUsingWhiteSpaceCharacters.validator';

export class UploadFileDto {
  // @ApiProperty({ type: 'string', format: 'binary' })
  // file: any;

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
}

export class UploadFileSwaggerDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;

  @ApiProperty()
  serialNumber!: string;

  @ApiProperty()
  accessToken!: string;
}
