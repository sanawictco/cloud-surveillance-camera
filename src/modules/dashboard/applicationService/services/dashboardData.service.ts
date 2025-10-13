import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { SendDataRequestDto } from '../../contracts/sendData.request.dto';
import { VideoDevicesApiForDashboardService } from 'src/modules/videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForDashboard.service';

@Injectable()
export class DashboardDataService {
  constructor(
    @Inject(forwardRef(() => VideoDevicesApiForDashboardService))
    private readonly videodevicesApiForDashboardService: VideoDevicesApiForDashboardService,
  ) {}

  async sendMoveData(body: SendDataRequestDto) {
    return await this.videodevicesApiForDashboardService.sendMoveData(
      body.cameraId,
      body.data,
    );
  }

  async sendZoomData(body: SendDataRequestDto) {
    return await this.videodevicesApiForDashboardService.sendZoomData(
      body.cameraId,
      body.data,
    );
  }
}
