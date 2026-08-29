/* eslint-disable security/detect-object-injection */
import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrderStates } from 'src/dddLib/applicationService';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { PageEntity } from '../../domain/page.entity';
import { UpdatePageProps } from '../../domain/page.type';
import { Widget } from '../../domain/valueObjects/pageContent.vo';
import { PAGE_REPOSITORY } from '../../infra/diTokens/page.diToken';
import { PageRepository } from '../../infra/repositories/page.repository';
import { PageActorLogService } from '../services/pageActorLog.service';

export class UpdatePageCommand
  extends Command
  implements Partial<UpdatePageProps>
{
  readonly name?: string;
  readonly tenantId: string;
  readonly nvrId?: string;
  readonly pageIndex?: number;
  readonly content?: Widget[];
  readonly runningConfigs?: Record<string, string>;

  constructor(props: CommandProps<UpdatePageCommand> & IdType) {
    super(props);
    this.name = props.name;
    this.tenantId = props.tenantId;
    this.nvrId = props.nvrId;
    this.pageIndex = props.pageIndex;
    this.content = props.content;
    this.runningConfigs = props.runningConfigs;
    if (!this.tenantId) throw new Error('tenantId is required');
  }
}

@CommandHandler(UpdatePageCommand)
export class UpdatePageCommandHandler implements ICommandHandler<UpdatePageCommand> {
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepo: PageRepository,
    private readonly pageActorLogService: PageActorLogService,
  ) {}

  async execute(command: UpdatePageCommand): Promise<AggregateID> {
    if (command.pageIndex !== undefined) {
      const pageEntities: PageEntity[] = await this.pageRepo.findAll(
        command.tenantId,
        {
          filter: command.nvrId ? { nvrId: command.nvrId } : undefined,
          orderBy: { column: 'pageIndex', status: OrderStates.ASCENDING },
        },
      );
      const pageEntity: PageEntity | undefined = pageEntities.find(
        (page) => page.id === command.id,
      );
      if (!pageEntity) throw new BadRequestException('not exists');
      const newPageIndex = command.pageIndex;
      const currPageIndex = pageEntity.getProps().pageIndex;
      pageEntities.splice(currPageIndex, 1);
      pageEntities.splice(newPageIndex, 0, pageEntity);
      for (const [index, page] of pageEntities.entries()) {
        if (index !== page.getProps().pageIndex) {
          page.update({ pageIndex: index });
          await this.pageRepo.update(page);
        }
      }
    }
    const pageEntity: PageEntity | undefined = command.nvrId
      ? await this.pageRepo.findOne(command.tenantId, {
          $and: [{ id: command.id }, { nvrId: command.nvrId }],
        })
      : await this.pageRepo.findById(command.tenantId, command.id);
    if (!pageEntity) throw new BadRequestException('not exists');

    const updateObj = {
      name: command.name,
      // pageIndex: command.pageIndex,
      content: command.content,
      runningConfigs: command.runningConfigs,
    };
    const currentOrOldName = pageEntity.getProps().name;
    const actorId = command.actorProps?.actorId;
    pageEntity.update(updateObj);
    await this.pageRepo.update(pageEntity);
    await this.processDependencies({
      pageEntity,
      actorId,
      currentOrOldName,
      updateObj,
    });
    return command.id;
  }
  private async processDependencies(props: {
    pageEntity: PageEntity;
    actorId?: string;
    currentOrOldName: string;
    updateObj: any;
  }) {
    const { currentOrOldName, actorId, pageEntity, updateObj } = props;
    await this.pageActorLogService.update({
      pageEntity: pageEntity,
      actorId: actorId,
      updatePageProps: {
        currentOrOldName,
        updatedProps: updateObj,
      },
    });
  }
}
