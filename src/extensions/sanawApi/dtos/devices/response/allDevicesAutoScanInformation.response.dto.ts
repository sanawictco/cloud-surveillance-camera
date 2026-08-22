export class AutoScanAllCamerasInformationResDto {
  statusCode: number;
  data: { cameras: ScanedCamera[] };
  constructor(statusCode: number, data: { cameras: ScanedCamera[] }) {
    this.statusCode = statusCode;
    this.data = data;
  }
}

export class ScanedCamera {
  id: number;
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
  constructor(
    id: number,
    cameraAggregateId: string,
    serialNumber: string,
    productModel: string,
    username: string,
    password: string,
    macAddress: string,
    streams: string,
    port: number,
    hasPtz: boolean,
    hasAudio: boolean,
  ) {
    this.id = id;
    this.cameraAggregateId = cameraAggregateId;
    this.serialNumber = serialNumber;
    this.productModel = productModel;
    this.username = username;
    this.password = password;
    this.macAddress = macAddress;
    this.streams = streams;
    this.port = port;
    this.hasPtz = hasPtz;
    this.hasAudio = hasAudio;
  }
}
