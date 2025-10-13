import { ActorDto } from 'src/modules/shared/dtos/actor.dto';
import { VideoDeviceEntityTypes } from 'src/modules/videoDevices/shared/valueObjects/videoDeviceEntityTypes';

export class VideoDeviceDataQueueMsgDto {
  msgId: string;
  configType: string;
  data: string;
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
