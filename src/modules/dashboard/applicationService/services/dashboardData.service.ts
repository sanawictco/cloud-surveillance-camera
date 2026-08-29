import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { SendDataRequestDto } from '../../contracts/sendData.request.dto';
import { VideoDevicesApiForDashboardService } from 'src/modules/videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForDashboard.service';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';

@Injectable()
export class DashboardDataService {
  constructor(
    @Inject(forwardRef(() => VideoDevicesApiForDashboardService))
    private readonly videodevicesApiForDashboardService: VideoDevicesApiForDashboardService,
  ) {}

  async sendMoveData(body: SendDataRequestDto) {
    const tenantId = UserInfoService.requireTenantId();
    return await this.videodevicesApiForDashboardService.sendMoveData(
      tenantId,
      body.cameraId,
      body.data,
    );
  }

  async sendZoomData(body: SendDataRequestDto) {
    const tenantId = UserInfoService.requireTenantId();
    return await this.videodevicesApiForDashboardService.sendZoomData(
      tenantId,
      body.cameraId,
      body.data,
    );
  }
}
