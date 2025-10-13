import { Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { PageResponseDto } from '../../contracts/page.response.dto';
import { PageEntity } from '../../domain/page.entity';
import { Widget } from '../../domain/valueObjects/pageContent.vo';
import { PageMapper } from '../../infra/mappers/page.mapper';
import { DeletePageCommand } from '../commands/deletePage.command';
import { RestorePagesToCacheCommand } from '../commands/restorePagesToCache.command';
import { UpdatePageCommand } from '../commands/updatePage.command';
import { FindAllPagesQuery } from '../queries/findAllPages.queryHandler';

@Injectable()
export class DashboardApiForVideoDevicesService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly pageMapper: PageMapper,
  ) {}

  async deleteCameraEffectFromWidgets(id: string) {
    const pageEntities: PageEntity[] =
      await this.serviceProvider.queryBus.execute(new FindAllPagesQuery());

    for (const pageEntity of pageEntities) {
      const pageProps = pageEntity.getProps();
      const { type } = pageProps;
      const content = pageProps.content as Widget[];
      const newContent: Widget[] = [];
      let updatable = false;
      for (const widget of content) {
        if (widget.id !== id) newContent.push(widget);
        else updatable = true;
      }
      if (updatable) {
        await this.serviceProvider.commandBus.execute(
          new UpdatePageCommand({
            id: pageEntity.id,
            content: newContent,
          }),
        );
      }
    }
  }

  async deleteDependentPages(nvrId: string) {
    const dependentPageEntities: PageEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllPagesQuery({
          filter: {
            nvrId,
          },
        }),
      );
    for (const pageEntity of dependentPageEntities) {
      await this.serviceProvider.commandBus.execute(
        new DeletePageCommand({ id: pageEntity.id }),
      );
    }
  }

  async getDependentPages(nvrId: string): Promise<PageResponseDto[]> {
    const dependentPageEntities: PageEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllPagesQuery({
          filter: {
            nvrId,
          },
        }),
      );
    return this.pageMapper.toResponseAll(dependentPageEntities);
  }

  async restoreToCache() {
    await this.serviceProvider.commandBus.execute(
      new RestorePagesToCacheCommand(),
    );
  }
}
