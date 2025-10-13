import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { WorkstationEntity } from '../../domain/workstation.entity';
import { UpdateWorkstationProps } from '../../domain/workstation.type';
import { WORKSTATION_REPOSITORY } from '../../infra/workstation.diToken';
import { WorkstationRepository } from '../../infra/workstation.repository';
import { WorkstationsActorLogService } from '../services/workstationActorLog.service';

export class UpdateWorkstationCommand
  extends Command
  implements Partial<UpdateWorkstationProps>
{
  readonly name?: string;

  constructor(props: CommandProps<UpdateWorkstationCommand> & IdType) {
    super(props);
    this.name = props.name;
  }
}

@CommandHandler(UpdateWorkstationCommand)
export class UpdateWorkstationCommandHandler
  implements ICommandHandler<UpdateWorkstationCommand>
{
  constructor(
    @Inject(WORKSTATION_REPOSITORY)
    protected readonly workstationRepo: WorkstationRepository,
    protected readonly workstationsActorLogService: WorkstationsActorLogService,
  ) {}

  async execute(command: UpdateWorkstationCommand): Promise<AggregateID> {
    const workstationEntity: WorkstationEntity | undefined =
      await this.workstationRepo.findById(command.id);
    const updateObj = {
      name: command.name,
    };
    if (!workstationEntity) throw new Error('entity not exists');
    workstationEntity.update(updateObj);
    await this.workstationRepo.update(workstationEntity);
    await this.processDependencies(command);
    return command.id;
  }
  private async processDependencies(command: UpdateWorkstationCommand) {
    if (command.name)
      await this.workstationsActorLogService.nameUpdated(command.name);
  }
}
