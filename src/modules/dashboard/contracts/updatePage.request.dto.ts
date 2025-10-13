import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { AvoidUsingSpecialCharacters } from 'src/modules/shared/avoidUsingSpecialCharacters.validator';

class WidgetDto {
  @ApiProperty()
  @IsUUID()
  id: string;
}

export class UpdatePageRequestDto {
  @ApiPropertyOptional()
  @IsString()
  @Length(1, 60)
  @Validate(AvoidUsingSpecialCharacters)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  @Min(0)
  destIndex?: number;

  @ApiPropertyOptional({ type: () => WidgetDto, isArray: true })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => WidgetDto)
  content?: WidgetDto[];
}
