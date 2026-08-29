import { Injectable } from '@nestjs/common';
import { VideoDevicesApiforTrashService } from 'src/modules/videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForTrash.service';
import { EmployeeAccessHttpService } from 'src/modules/tenantAccess/applicationService/employeeAccess.http.service';
@Injectable()
export class TrashService {
  constructor(
    private readonly videoDevicesApiForTrashService: VideoDevicesApiforTrashService,
    private readonly employeeService: EmployeeAccessHttpService,
  ) {}

  async find(tenantId: string) {
    const [cameras, employees] = await Promise.all([
      this.videoDevicesApiForTrashService.getSoftDeletedCameras(tenantId),
      this.employeeService.getSoftDeletedEmployees(),
    ]);
    return {
      cameras,
      employees,
    };
  }
}
