import {
  BaseResponseProps,
  ResponseBase,
} from 'src/dddLib/contracts/response.base';
import { StreamsProps } from '../../../domain/camera/valueObjects/streams.vo';

interface CameraResponseProps extends BaseResponseProps {
  tenantId: string;
  name: string;
  productModel: string;
  macAddress: string;
  port: number;
  streams: StreamsProps;
  hasPtz: boolean;
  hasAudio: boolean;
  nvrId: string;
}

export class CameraResponseDto extends ResponseBase {
  tenantId: string;
  name: string;
  productModel: string;
  macAddress: string;
  port: number;
  streams: StreamsProps;
  hasPtz: boolean;
  hasAudio: boolean;
  nvrId: string;

  constructor(props: CameraResponseProps) {
    super(props);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.productModel = props.productModel;
    this.macAddress = props.macAddress;
    this.port = props.port;
    this.streams = props.streams;
    this.hasPtz = props.hasPtz;
    this.hasAudio = props.hasAudio;
    this.nvrId = props.nvrId;
  }
}
