import { ActorDto } from './actor.dto';

export class ActorPropsMsgIdDto {
  constructor(
    public actorProps: ActorDto | undefined,
    public msgId: string,
  ) {}
}
