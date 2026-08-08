import { ActorDto } from 'src/modules/shared/dtos/actor.dto';

export class PageConfigQueueMsgDto {
  constructor(
    public msgId: string,
    public configType: string,
    public data: object,
    public nvrId: string,
    public metadata: {
      topic: string;
      retryCount: number;
      retryPeriodInSecond: number;
      entityId: string;
      actorProps?: ActorDto;
      issuedAt?: number;
    },
  ) {}
}
