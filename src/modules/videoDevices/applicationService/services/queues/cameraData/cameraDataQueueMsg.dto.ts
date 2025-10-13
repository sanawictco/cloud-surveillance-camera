import { ActorDto } from 'src/modules/shared/dtos/actor.dto';

export class CameraDataQueueMsgDto {
  msgId: string;
  configType: string;
  data: string;
  metadata: {
    topic: string;
    retryCount: number;
    retryPeriodInSecond: number;
    entityId: string;
    actorProps?: ActorDto;
    issuedAt?: number;
  };
}
