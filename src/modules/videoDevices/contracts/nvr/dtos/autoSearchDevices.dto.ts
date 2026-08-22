import { CreateCameraProps } from '../../../domain/camera/camera.type';

export type AutoSearchDevicesDto = {
  macAddresses: string[];
}[];

export interface AutoSearchRecognizeDeviceDto {
  addedCameras: string[]; //array of macAddresses
  deletedCameras: SanitizedNvrCameraDto[];
}

export type FinalAutoSearchResult = {
  addedCameras: {
    productModel: string;
    serialNumber: string;
    name: string;
    hasPtz: boolean;
    hasAudio: boolean;
  }[];
  deletedCameras: SanitizedNvrCameraDto[];
}[];

export interface SanitizedNvrCameraDto {
  id: string;
  serialNumber: string;
  productModel: string;
  name: string;
}

export interface PrivateSearchCamera {
  managementCameraId: number;
  cameraAggregateId: string;
  serialNumber: string;
  productModel: string;
  username: string;
  password: string;
  macAddress: string;
  streams: string;
  port: number;
  hasPtz: boolean;
  hasAudio: boolean;
  name: string;
}

export interface NvrPrivateSearchCache {
  addedCameras: PrivateSearchCamera[];
  deletedCameras: SanitizedNvrCameraDto[];
}

export interface AutoRegisterBatchConfig {
  nvrId: string;
  tenantId: string;
  addedCameras: CreateCameraProps[];
  deletedCameras: SanitizedNvrCameraDto[];
}
