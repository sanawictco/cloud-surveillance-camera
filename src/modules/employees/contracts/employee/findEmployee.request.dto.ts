import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class FindEmployeeRequestDto {
  @ApiProperty()
  @IsPhoneNumber('IR')
  phoneNumber: string;
}
