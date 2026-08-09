import { IsNotEmpty, IsString } from 'class-validator';

export class PageMqttRequestDto {
  @IsString()
  @IsNotEmpty()
  msgId!: string;
}
