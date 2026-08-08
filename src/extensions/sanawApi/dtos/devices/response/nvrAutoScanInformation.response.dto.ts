export class NvrAutoScanInformationResponseDto {
  statusCode: number;
  data: {
    productModel: string;
    serialNumber: string;
  };

  constructor(
    statusCode: number,
    data: { productModel: string; serialNumber: string },
  ) {
    this.statusCode = statusCode;
    this.data = data;
  }
}
