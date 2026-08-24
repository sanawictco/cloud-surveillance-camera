import { Injectable } from '@nestjs/common';
import { EmployeeApiForTrashService } from 'src/modules/employees/applicatoinService/apiForAnotherServices/employeeApiForTrash.service';
import { VideoDevicesApiforTrashService } from 'src/modules/videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForTrash.service';
@Injectable()
export class TrashService {
  constructor(
    private readonly videoDevicesApiForTrashService: VideoDevicesApiforTrashService,
    private readonly employeeApiForTrashService: EmployeeApiForTrashService,
  ) {}

  async find() {
    const [cameras, employees] = await Promise.all([
      this.videoDevicesApiForTrashService.getSoftDeletedCameras(),
      this.employeeApiForTrashService.getSoftDeletedEmployees(),
    ]);
    return {
      cameras,
      employees,
    };
  }
}
