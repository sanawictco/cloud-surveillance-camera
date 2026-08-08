export class nvrAutoRegisterInformationResponseDto {
  statusCode: number;
  data: {
    accessToken: string;
    password: string;
    serialNumber: string;
    productModel: string;
    maxCamers: number;
  };
  constructor(
    statusCode: number,
    data: {
      accessToken: string;
      password: string;
      serialNumber: string;
      productModel: string;
      maxCamers: number;
    },
  ) {
    this.statusCode = statusCode;
    this.data = data;
  }
}
