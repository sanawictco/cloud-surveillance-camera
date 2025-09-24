export class GatewayAutoRegisterInformationResponseDto {
  statusCode: number;
  data: {
    accessToken: string;
    manufacturedGatewayId: number;
    maxMsgRateInMsgCountPerMin: number;
    productModel: string;
    password: string;
    communicationStructure: CommunicationStructure;
  };
}

class CommunicationStructure {
  name: string;
  commands: string;
}
