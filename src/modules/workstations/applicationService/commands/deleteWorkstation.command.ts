import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { WorkstationEntity } from '../../domain/workstation.entity';
import { WORKSTATION_REPOSITORY } from '../../infra/workstation.diToken';
import { WorkstationRepository } from '../../infra/workstation.repository';

export class DeleteWorkstationCommand extends Command {
  constructor(props: CommandProps<DeleteWorkstationCommand> & IdType) {
    super(props);
  }
}

@CommandHandler(DeleteWorkstationCommand)
export class DeleteWorkstationCommandHandler
  implements ICommandHandler<DeleteWorkstationCommand>
{
  constructor(
    @Inject(WORKSTATION_REPOSITORY)
    protected readonly workstationRepo: WorkstationRepository,
  ) {}

  async execute(command: DeleteWorkstationCommand): Promise<AggregateID> {
    const workstationEntity: WorkstationEntity | undefined =
      await this.workstationRepo.findById(command.id);
    if (!workstationEntity) throw new Error('entity not exists');
    workstationEntity.delete();
    await this.workstationRepo.update(workstationEntity);
    return command.id;
  }
}
