import { AggregateID } from 'src/dddLib/core';
import { ActorDto } from 'src/modules/shared/dtos/actor.dto';

export interface FogConfigResponseDto {
  msgId: string;
  configType: string;
  data: object;
  nvrId: AggregateID;
  tenantId?: AggregateID;
  metadata: {
    topic: string;
    retryCount: number;
    retryPeriodInSecond: number;
    entityId: AggregateID;
    entityType?: string;
    issuedAt?: number;
    actorProps?: ActorDto;
  };
}
