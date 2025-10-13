import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { WorkstationEntity } from '../../domain/workstation.entity';
import { CreateWorkstationProps } from '../../domain/workstation.type';
import { WORKSTATION_REPOSITORY } from '../../infra/workstation.diToken';
import { WorkstationRepository } from '../../infra/workstation.repository';

export class CreateWorkstationCommand
  extends Command
  implements CreateWorkstationProps
{
  readonly name: string;

  constructor(props: CommandProps<CreateWorkstationCommand>) {
    super(props);
    this.name = props.name;
  }
}

@CommandHandler(CreateWorkstationCommand)
export class CreateWorkstationCommandHandler
  implements ICommandHandler<CreateWorkstationCommand>
{
  constructor(
    @Inject(WORKSTATION_REPOSITORY)
    protected readonly workstationRepo: WorkstationRepository,
  ) {}

  async execute(command: CreateWorkstationCommand): Promise<AggregateID> {
    const workstation = WorkstationEntity.create({
      name: command.name,
    });
    await this.workstationRepo.insert(workstation);
    return workstation.id;
  }
}
