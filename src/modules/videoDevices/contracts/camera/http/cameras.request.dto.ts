import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';
import { AggregateID } from 'src/dddLib/core';
import { Guard } from 'src/dddLib/utils';
export class CameraIdsRequestDto {
  @ApiProperty({
    type: [String],
    description: 'array of camera UUIDs',
  })
  @Transform(({ value }) => (Guard.isString(value) ? value.split(',') : value))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  cameraIds!: AggregateID[];
}
