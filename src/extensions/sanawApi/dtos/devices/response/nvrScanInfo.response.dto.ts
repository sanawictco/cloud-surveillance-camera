export interface NvrScanInfoResponseDto {
  statusCode: number;
  data: NvrScanInfoData;
}

export interface NvrScanInfoData {
  productModel: string;
  serialNumber: string;
}
