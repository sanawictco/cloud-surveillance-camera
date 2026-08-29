import { Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindAllCamerasForTenantQuery } from '../../queries/camera/findAllCameras.queryHandler';
import { CameraMapper } from 'src/modules/videoDevices/infra/camera/camera.mapper';

@Injectable()
export class VideoDevicesApiforTrashService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly cameraMapper: CameraMapper,
  ) {}
  async getSoftDeletedCameras(tenantId: string) {
    const cameraEntities: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasForTenantQuery(tenantId, {
          filter: { isDeleted: true },
        }),
      );
    return this.cameraMapper.toResponseAll(cameraEntities);
  }
}
