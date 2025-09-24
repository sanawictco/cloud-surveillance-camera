export enum DeviceTypesEnum {
  GATEWAY = 'gateway',
  ACCESS_POINT = 'accessPoint',
  END_DEVICE = 'endDevice',
}
export class AutoScanAllDevicesInformationResDto {
  statusCode: number;
  data: { devices: ScanedDevices[] };
}

export class ScanedDevices {
  accessPoint: ScanedAccessPoint;
  endDevices: ScanedEndDevice[];
}

export class ScanedAccessPoint {
  macAddress: number;
  maxMsgRateInMsgCountPerMin: number;
  productModel: string;
  serialNumber: string;
  behavior: AccessPointBehavior;
}

export class ScanedEndDevice {
  macAddress: number;
  productModel: string;
  serialNumber: string;
  behavior: EndDeviceBehavior;
}

class AccessPointBehavior {
  id: number;
  name: string;
  communicationStructures: AccessPointCommunicationStructureDto[];
}

class AccessPointCommunicationStructureDto {
  id: number;
  name: string;
  commands: string;
}

class EndDeviceBehavior {
  id: number;
  name: string;
  communicationStructures: EndDeviceCommunicationStructureDto[];
}

class EndDeviceCommunicationStructureDto {
  id: number;
  name: string;
  analogInputIndex: number;
  widgetStructure: string;
  commands: string;
}
