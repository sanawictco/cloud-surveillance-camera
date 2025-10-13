export class NvrAutoScanInformationResponseDto {
  statusCode: number;
  data: {
    productModel: string;
    serialNumber: string;
  };
}
