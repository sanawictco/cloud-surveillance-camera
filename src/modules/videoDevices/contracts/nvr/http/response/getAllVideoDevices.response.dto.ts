import { CameraResponseDto } from '../../../camera/http/camera.response.dto';
import { NvrResponseDto } from './nvr.response.dto';

export interface GetAllVideoDevicesResposeDto {
  nvrs: NvrResponseDto[];
  cameras: CameraResponseDto[];
}
