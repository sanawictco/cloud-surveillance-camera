import { Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { WebsocketService } from 'src/extensions/websocket/websocket.service';
import { CreatePageWsResponseDto } from '../../contracts/createPage.wsResponse.dto';
import { DeletePageWsResponseDto } from '../../contracts/deletePage.wsResponse.dto';
import { UpdatePageWsResponseDto } from '../../contracts/updatePage.wsResponse.dto';
import { PageEntity } from '../../domain/page.entity';
import { PageConfigs, PageWebsocketTypes } from '../../domain/page.type';
import { PageMapper } from '../../infra/mappers/page.mapper';
import { CreatePageCommand } from '../commands/createPage.command';
import { DeletePageCommand } from '../commands/deletePage.command';
import { UpdatePageCommand } from '../commands/updatePage.command';
import { FindPageByIdForTenantQuery } from '../queries/findPageById.queryHandler';
import { ActorPropsMsgIdDto } from 'src/modules/shared/dtos/actorPropsMsgId.dto';
import { CreatePageProps, UpdatePageProps } from '../../domain/page.type';

@Injectable()
export class PagesMqttService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly websocketService: WebsocketService,
    private readonly pageMapper: PageMapper,
  ) {}

  async create(
    tenantId: string,
    nvrId: string,
    data: CreatePageProps & { id: string },
    metadata: ActorPropsMsgIdDto,
  ) {
    const { actorProps, msgId } = metadata;
    const id = await this.serviceProvider.commandBus.execute(
      new CreatePageCommand({
        ...data,
        tenantId,
        nvrId,
        originId: data.id,
        actorProps,
      }),
    );
    const newPageEntity: PageEntity =
      await this.serviceProvider.queryBus.execute(
        new FindPageByIdForTenantQuery(tenantId, [nvrId], id),
      );
    this.websocketService.sendTenantMessage<CreatePageWsResponseDto>(
      tenantId,
      this.websocketService.channels.PAGES_SOCKET,
      {
        type: PageWebsocketTypes.CONFIG,
        data: this.pageMapper.toResponse(newPageEntity),
        message: {
          msgKey: LanguageKeys.dashboard.response.socket.created,
        },
        metadata: {
          configType: PageConfigs.CREATE_PAGE,
          msgId,
        },
      },
    );
  }

  async update(
    tenantId: string,
    nvrId: string,
    data: UpdatePageProps & { id: string },
    metadata: ActorPropsMsgIdDto,
  ) {
    const { actorProps, msgId } = metadata;
    await this.serviceProvider.commandBus.execute(
      new UpdatePageCommand({ ...data, tenantId, nvrId, actorProps }),
    );

    const updatedPageEntity: PageEntity =
      await this.serviceProvider.queryBus.execute(
        new FindPageByIdForTenantQuery(tenantId, [nvrId], data.id),
      );

    this.websocketService.sendTenantMessage<UpdatePageWsResponseDto>(
      tenantId,
      this.websocketService.channels.PAGES_SOCKET,
      {
        type: PageWebsocketTypes.CONFIG,
        data: this.pageMapper.toResponse(updatedPageEntity),
        message: {
          msgKey: LanguageKeys.dashboard.response.socket.updated,
        },
        metadata: {
          configType: PageConfigs.UPDATE_PAGE,
          msgId,
        },
      },
    );
  }

  async delete(
    tenantId: string,
    nvrId: string,
    pageEntity: PageEntity,
    data: { id: string },
    metadata: ActorPropsMsgIdDto,
  ) {
    const { actorProps, msgId } = metadata;
    if (!pageEntity) return;
    await this.serviceProvider.commandBus.execute(
      new DeletePageCommand({ id: data.id, tenantId, nvrId, actorProps }),
    );

    this.websocketService.sendTenantMessage<DeletePageWsResponseDto>(
      tenantId,
      this.websocketService.channels.PAGES_SOCKET,
      {
        type: PageWebsocketTypes.CONFIG,
        data: { id: data.id },
        message: {
          msgKey: LanguageKeys.dashboard.response.socket.deleted,
        },
        metadata: {
          configType: PageConfigs.DELETE_PAGE,
          msgId,
        },
      },
    );
  }
}
