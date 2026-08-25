import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import { FogBackupRestoreSwaggerDto } from './contracts/fogBackupRestore.request.dto';
import type { AuthenticatedFogBackupRequest } from './fogBackupAuth.guard';
import { FogBackupAuthGuard } from './fogBackupAuth.guard';
import { fogBackupFileFilter, fogBackupStorage } from './fogBackupUpload';
import { FogCommunicationManagerService } from './fogCommunicationManager.service';

@ApiTags('/fog-communication-manager')
@Controller('/fog-communication-manager')
export class FogCommunicationManagerController {
  constructor(
    private readonly fogCommunicationManagerService: FogCommunicationManagerService,
  ) {}

  @Post('/restore-fog-backup-to-cloud')
  @UseGuards(FogBackupAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FogBackupRestoreSwaggerDto })
  @ApiHeader({ name: 'X-Tenant-Id', required: true })
  @ApiHeader({ name: 'X-Nvr-Serial-Number', required: true })
  @ApiHeader({ name: 'X-Nvr-Access-Token', required: true })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: fogBackupStorage,
      fileFilter: fogBackupFileFilter,
      limits: { fileSize: 1024 * 1024 * 1024 },
    }),
  )
  restoreFogBackupToCloud(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: AuthenticatedFogBackupRequest,
  ): Promise<void> {
    return this.fogCommunicationManagerService.restoreFogBackupToCloud(
      request.fogNvr,
      file,
    );
  }
}
