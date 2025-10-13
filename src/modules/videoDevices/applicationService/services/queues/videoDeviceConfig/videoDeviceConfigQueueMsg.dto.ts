import { ActorDto } from 'src/modules/shared/dtos/actor.dto';
import { VideoDeviceEntityTypes } from 'src/modules/videoDevices/shared/valueObjects/videoDeviceEntityTypes';

export class VideoDeviceConfigQueueMsgDto {
  msgId: string;
  configType: string;
  data: object;
  nvrId: string;
  metadata: {
    topic: string;
    retryCount: number;
    retryPeriodInSecond: number;
    entityId: string;
    entityType: VideoDeviceEntityTypes;
    actorProps?: ActorDto;
    issuedAt?: number;
  };
}
