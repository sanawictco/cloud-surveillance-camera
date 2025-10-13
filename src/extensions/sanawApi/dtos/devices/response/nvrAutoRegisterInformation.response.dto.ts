export class nvrAutoRegisterInformationResponseDto {
  statusCode: number;
  data: {
    accessToken: string;
    password: string;
    serialNumber: string;
    productModel: string;
    maxCamers: number;
  };
}
