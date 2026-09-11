import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsTimeZone, Length } from 'class-validator';

export class CreateTenantRequestDto {
  @ApiProperty()
  @IsString()
  @Length(1, 60)
  name!: string;

  @ApiProperty()
  @IsTimeZone()
  defaultTimezone!: string;
}
