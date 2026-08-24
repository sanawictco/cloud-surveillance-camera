import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  UploadFileDto,
  UploadFileSwaggerDto,
} from './contracts/fileUpload.request.dto';
import { FogConfigReqDto } from './contracts/fogConfig.dto';
import { FogConfigResponseDto } from './contracts/fogConfig.response.dto';
import { fileFilter, storage } from './fileUpload';
import { FogCommunicationManagerService } from './fogCommunicationManager.service';
import { ApiNodeProxyRequestDto } from './contracts/apiNodeProxy.request.dto';

@ApiTags('/fog-communication-manager')
@Controller('/fog-communication-manager')
export class FogCommunicationManagerController {
  constructor(
    private readonly fogCommunicationManagerService: FogCommunicationManagerService,
  ) {}
  @Post('/configs')
  async deliverMqttConfigOverHttpToFog(
    @Body() body: FogConfigReqDto,
  ): Promise<FogConfigResponseDto> {
    return this.fogCommunicationManagerService.deliverMqttConfigOverHttpToFog(
      body,
    );
  }

  @Post('/api-node/request')
  async proxyApiNodeRequest(@Body() body: ApiNodeProxyRequestDto) {
    return this.fogCommunicationManagerService.proxyApiNodeRequest(body);
  }

  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileSwaggerDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GiB
      fileFilter,
    }),
  )
  @Post('/restore-fog-backup-to-cloud')
  async restoreFogBackupToCloud(
    @UploadedFile() _file: Express.Multer.File,
    @Body() body: UploadFileDto,
  ) {
    return await this.fogCommunicationManagerService.restoreFogBackupToCloud(
      body,
    );
  }
}
