import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindCameraByIdQuery } from '../../queries/camera/findCameraById.queryHandler';
import { CameraValidator } from '../http/validators/camera.validator';

export class VideoDevicesApiBaseService {
  constructor(
    protected readonly cameraValidator: CameraValidator,
    protected serviceProvider: ServiceProvider,
  ) {}
  async checkSendDataCommandIsValid(
    _cameraEntity: CameraEntity,
    _cmdStructuresValue: number[],
  ) {
    //TODO
    return true;
  }
  async findCameraWithId(id: string): Promise<CameraEntity> {
    const cameraEntity: CameraEntity =
      await this.serviceProvider.queryBus.execute(new FindCameraByIdQuery(id));
    return cameraEntity;
  }
}
