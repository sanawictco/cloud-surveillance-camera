import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class AutoRegisterRequestDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  nvrId!: string;

  @ApiProperty({ isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Length(8, 8, { each: true })
  @Matches(/^[A-Z0-9]{8}$/, { each: true })
  addedCameras!: string[];

  @ApiProperty({ isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Length(8, 8, { each: true })
  @Matches(/^[A-Z0-9]{8}$/, { each: true })
  deletedCameras!: string[];
}
