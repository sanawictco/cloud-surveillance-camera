import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Validate } from 'class-validator';
import { AvoidUsingSpecialCharacters } from 'src/modules/shared/avoidUsingSpecialCharacters.validator';
import { AvoidUsingWhiteSpaceCharacters } from 'src/modules/shared/avoidUsingWhiteSpaceCharacters.validator';

export class ScanNvrRequestDto {
  @ApiProperty()
  @IsString()
  @Length(8, 8)
  @Validate(AvoidUsingSpecialCharacters)
  @Validate(AvoidUsingWhiteSpaceCharacters)
  serialNumber!: string;
}
