import { AggregateID } from 'src/dddLib/core';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreatePageProps } from '../../domain/page.type';
import { PAGE_REPOSITORY } from '../../infra/diTokens/page.diToken';
import { PageEntity } from '../../domain/page.entity';
import { PageRepository } from '../../infra/repositories/page.repository';
import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { PageActorLogService } from '../services/pageActorLog.service';
import { PageTypes } from '../../domain/valueObjects/pageType.vo';

export class CreatePageCommand extends Command implements CreatePageProps {
  readonly originId?: string;
  readonly name: string;
  readonly nvrId: string;
  readonly type: PageTypes;
  constructor(props: CommandProps<CreatePageCommand>) {
    super(props);
    this.originId = props.originId;
    this.name = props.name;
    this.nvrId = props.nvrId;
    this.type = props.type;
  }
}

@CommandHandler(CreatePageCommand)
export class CreatePageCommandHandler
  implements ICommandHandler<CreatePageCommand>
{
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepo: PageRepository,
    private readonly pageActorLogService: PageActorLogService,
  ) {}

  async execute(command: CreatePageCommand): Promise<AggregateID> {
    const maxPageIndexQuery = await this.pageRepo.aggregate({
      pageIndex: { $max: '$pageIndex' },
    });
    const pageEntity: PageEntity = PageEntity.create({
      originId: command.originId,
      name: command.name,
      nvrId: command.nvrId,
      pageIndex: maxPageIndexQuery[0] ? maxPageIndexQuery[0].pageIndex + 1 : 0,
      type: command.type,
    });
    await this.pageRepo.insert(pageEntity);
    const actorId = command.actorProps?.actorId;
    await this.processDependencies(pageEntity, actorId);
    return pageEntity.id;
  }

  private async processDependencies(pageEntity: PageEntity, actorId?: string) {
    await this.pageActorLogService.create({
      pageEntity,
      actorId,
    });
  }
}
