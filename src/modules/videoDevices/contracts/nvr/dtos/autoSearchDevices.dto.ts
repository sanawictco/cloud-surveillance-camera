import { CameraResponseDto } from '../../camera/http/camera.response.dto';

export type AutoSearchDevicesDto = {
  macAddresses: string[];
}[];

export interface AutoSearchRecognizeDeviceDto {
  addedCameras: string[]; //array of macAddresses
  deletedCameras: CameraResponseDto[];
}

export type FinalAutoSearchResult = {
  addedCameras: {
    productModel: string;
    serialNumber: string;
    name: string;
  }[];
  deletedCameras: CameraResponseDto[];
}[];
