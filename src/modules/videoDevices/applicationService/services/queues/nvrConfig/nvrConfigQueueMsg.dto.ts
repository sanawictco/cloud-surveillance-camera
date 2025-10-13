import { ActorDto } from 'src/modules/shared/dtos/actor.dto';

export class NvrConfigQueueMsgDto {
  msgId: string;
  configType: string;
  data: object;
  nvrId: string;
  metadata: {
    topic: string;
    retryCount: number;
    retryPeriodInSecond: number;
    entityId: string;
    actorProps?: ActorDto;
    issuedAt?: number;
  };
}
