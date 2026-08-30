import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AggregateID } from 'src/dddLib/core';
import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';
import { NvrActorLogService } from '../../services/actorLogs/nvrActorLog.service';
import { NvrLiveSignalService } from '../../services/liveSignals/nvrLiveSignal.service';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';

export class ActiveNvrCommand extends Command {
  /** Verified owning tenant; when present the handler fails closed on a foreign NVR. */
  readonly tenantId?: string;

  constructor(props: CommandProps<ActiveNvrCommand>) {
    super(props);
    this.tenantId = props.tenantId;
  }
}

@CommandHandler(ActiveNvrCommand)
export class ActiveNvrCommandHandler implements ICommandHandler<ActiveNvrCommand> {
  constructor(
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepo: NvrRepository,
    private readonly nvrActorLogService: NvrActorLogService,
    private readonly nvrLiveSignalService: NvrLiveSignalService,
  ) {}

  async execute(command: ActiveNvrCommand): Promise<AggregateID> {
    const nvrEntity: NvrEntity | undefined = await this.nvrRepo.findById(
      command.id,
    );
    if (!nvrEntity) throw Error('not exist nvr with id');
    if (command.tenantId && nvrEntity.getProps().tenantId !== command.tenantId) {
      throw Error('not exist nvr with id');
    }
    nvrEntity.active();
    await this.nvrRepo.update(nvrEntity);
    const actorId = command.actorProps?.actorId;
    if (!actorId) throw new Error('actorId does not exist');
    await this.processDependencies(nvrEntity, actorId);
    return command.id;
  }

  private async processDependencies(nvrEntity: NvrEntity, actorId: string) {
    await this.nvrLiveSignalService.start(nvrEntity);
    await this.nvrActorLogService.active({
      nvrEntity,
      actorId,
    });
  }
}
