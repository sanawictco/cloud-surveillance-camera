export class AllDevicesAutoScanInformationReqDto {
  autoScanReqObjects!: AllDevicesAutoScanReqObjectDto[];
}

export class AllDevicesAutoScanReqObjectDto {
  accessPointMacAddress!: number;
  accessPointBehaviorId!: number;
  endDevices!: EndDevicesReqObjectDto[];
}
class EndDevicesReqObjectDto {
  macAddress!: number;
  behaviorId!: number;
}
