import { CreateCameraProps } from 'src/modules/videoDevices/domain/camera/camera.type';
import { CameraResponseDto } from '../../camera/http/camera.response.dto';

export type AutoRegisterFullContent = {
  addedCameras: CreateCameraProps[];
  deletedCameras: string[];
};

export interface UnregisteredDeviceContext {
  unRegisteredMacAddresses: number[];
  unRegisteredSerialNumbers: string[];
}

export interface AutoRegisterProcessingResult {
  addedCamerasRes: CameraResponseDto[];
  deletedCamerasRes: CameraResponseDto[];
  unRegisteredCameraserialNumbers: string[];
}
