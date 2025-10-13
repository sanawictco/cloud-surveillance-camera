export class AutoScanAllCamerasInformationResDto {
  statusCode: number;
  data: { cameras: ScanedCamera[] };
}

export class ScanedCamera {
  id: number;
  productModel: string;
  serialNumber: string;
  username: string;
  password: string;
  macAddress: string;
  streams: string;
  port: number;
  hasPtz: boolean;
  hasAudio: boolean;
}
