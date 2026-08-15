import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsMACAddress,
  IsString,
  IsUUID,
} from 'class-validator';

export class AutoRegisterRequestDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  nvrId!: string;

  @ApiProperty({ isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @IsMACAddress({ each: true })
  addedCameras!: string[];

  @ApiProperty({ isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @IsMACAddress({ each: true })
  deletedCameras!: string[];
}

export type AutoRegisterFullContent = {
  addedCameras: string[];
  deletedCameras: string[];
};
