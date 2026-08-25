import { ApiProperty } from '@nestjs/swagger';

export class FogBackupRestoreSwaggerDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: string;
}
