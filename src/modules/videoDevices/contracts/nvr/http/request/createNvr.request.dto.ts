import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Validate } from 'class-validator';
import { ScanNvrRequestDto } from './scanNvr.request.dto';
import { AvoidUsingSpecialCharacters } from 'src/modules/shared/avoidUsingSpecialCharacters.validator';

export class CreateNvrRequestDto extends ScanNvrRequestDto {
  @ApiProperty()
  @IsString()
  @Length(1, 60)
  @Validate(AvoidUsingSpecialCharacters)
  name!: string;
}
