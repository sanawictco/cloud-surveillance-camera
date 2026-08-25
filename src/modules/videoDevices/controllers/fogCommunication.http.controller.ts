import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { VideoDevicesApiForFogCommunicationManagerService } from '../applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service';
import { FogVideoDeviceConfigRequestDto } from '../contracts/nvr/http/request/fogConfig.request.dto';

@Controller('/fog-communication-manager')
export class FogCommunicationHttpController {
  constructor(
    private readonly fogApi: VideoDevicesApiForFogCommunicationManagerService,
  ) {}

  @Post('/configs')
  async getConfig(@Body() body: FogVideoDeviceConfigRequestDto) {
    try {
      return await this.fogApi.getOwnedFogConfig(body);
    } catch {
      // Authentication, ownership, expiry, and lookup failures intentionally
      // share one response so msgId cannot be used as an inventory oracle.
      throw new NotFoundException('configuration is unavailable');
    }
  }
}
