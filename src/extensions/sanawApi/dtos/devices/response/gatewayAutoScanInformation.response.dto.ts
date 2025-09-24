export class GatewayAutoScanInformationResponseDto {
  statusCode: number;
  data: {
    productModel: string;
    communicationStructures: CommunicationStructure[];
  };
}

class CommunicationStructure {
  id: string;
  name: string;
}
