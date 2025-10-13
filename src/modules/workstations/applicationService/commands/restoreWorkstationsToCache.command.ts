import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Command } from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { WORKSTATION_REPOSITORY } from '../../infra/workstation.diToken';
import { WorkstationRepository } from '../../infra/workstation.repository';

export class RestoreWorkstationToCacheCommand extends Command {
  constructor() {
    super({ id: '' });
  }
}

@CommandHandler(RestoreWorkstationToCacheCommand)
export class RestoreWorkstationToCacheCommandHandler
  implements ICommandHandler<RestoreWorkstationToCacheCommand>
{
  constructor(
    @Inject(WORKSTATION_REPOSITORY)
    protected readonly workstationRepo: WorkstationRepository,
  ) {}

  async execute(
    command: RestoreWorkstationToCacheCommand,
  ): Promise<AggregateID> {
    await this.workstationRepo.restoreAndInitRecordsToCache();
    return command.id;
  }
}
