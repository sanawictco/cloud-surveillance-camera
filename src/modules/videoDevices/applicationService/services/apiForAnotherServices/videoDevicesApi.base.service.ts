import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { CameraValidator } from '../validators/camera.validator';

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
}
