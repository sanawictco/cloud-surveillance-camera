import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ArgumentInvalidException } from 'src/dddLib/core/exceptions';
import { Guard } from 'src/dddLib/utils';
import {
  ACTOR_LOG_ACTOR_ID_COLUMN_SIZE,
  assertActorLogTenantId,
} from 'src/modules/actorLogs/domain/actorLog.type';
import { ACTOR_LOG_REPOSITORY } from '../../infra/actorLog.diToken';
import { ActorLogRepository } from '../../infra/actorLog.timeseriesRepository';

export class DeleteTenantActorLogsCommand extends Command {
  readonly tenantId: string;
  /** Restrict deletion to these actor IDs (e.g. one removed member). */
  readonly actorIds: string[];

  constructor(props: CommandProps<DeleteTenantActorLogsCommand>) {
    super(props);
    assertActorLogTenantId(props.tenantId);
    if (
      !Array.isArray(props.actorIds) ||
      props.actorIds.length === 0 ||
      props.actorIds.some(
        (actorId) =>
          !Guard.isBetween(actorId, 1, ACTOR_LOG_ACTOR_ID_COLUMN_SIZE),
      )
    ) {
      throw new ArgumentInvalidException(
        'actor log deletion requires explicit actor ids',
      );
    }
    this.tenantId = props.tenantId;
    this.actorIds = props.actorIds;
  }
}

@CommandHandler(DeleteTenantActorLogsCommand)
export class DeleteTenantActorLogsCommandHandler implements ICommandHandler<DeleteTenantActorLogsCommand> {
  constructor(
    @Inject(ACTOR_LOG_REPOSITORY)
    protected readonly actorLogRepo: ActorLogRepository,
  ) {}

  async execute(command: DeleteTenantActorLogsCommand): Promise<void> {
    for (const actorId of command.actorIds) {
      await this.actorLogRepo.dropByActor(command.tenantId, actorId);
    }
  }
}
