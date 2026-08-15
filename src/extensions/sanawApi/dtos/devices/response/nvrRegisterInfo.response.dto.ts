export class NvrRegisterInfoResponseDto {
  statusCode: number;
  data: {
    accessToken: string;
    password: string;
    serialNumber: string;
    productModel: string;
    maxCameras: number;
  };
  constructor(
    statusCode: number,
    data: {
      accessToken: string;
      password: string;
      serialNumber: string;
      productModel: string;
      maxCameras: number;
    },
  ) {
    this.statusCode = statusCode;
    this.data = data;
  }
}
