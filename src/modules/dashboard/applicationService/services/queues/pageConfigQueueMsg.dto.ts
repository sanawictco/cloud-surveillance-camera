import { ActorDto } from 'src/modules/shared/dtos/actor.dto';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';

export class PageConfigQueueMsgDto {
  constructor(
    public msgId: string,
    public configType: string,
    public data: object,
    public nvrId: string,
    public tenantId: string,
    public metadata: {
      topic: string;
      retryCount: number;
      retryPeriodInSecond: number;
      entityId: string;
      entityType: EntityTypes.PAGE;
      actorProps?: ActorDto;
      issuedAt?: number;
      expiresAt?: number;
    },
  ) {}
}
