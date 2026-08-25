import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStates } from 'src/dddLib/applicationService';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { CreatePageRequestDto } from '../../contracts/createPage.request.dto';
import {
  GetAllPagesResponseDto,
  PageResponseDto,
} from '../../contracts/page.response.dto';
import { UpdatePageRequestDto } from '../../contracts/updatePage.request.dto';
import { PageEntity } from '../../domain/page.entity';
import { PageConfigs } from '../../domain/page.type';
import { PageMapper } from '../../infra/mappers/page.mapper';
import { FindAllPagesQuery } from '../queries/findAllPages.queryHandler';
import { FindPageByIdQuery } from '../queries/findPageById.queryHandler';
import { PageRunningConfigService } from './pageRunningConfig.service';
import { PageTypes } from '../../domain/valueObjects/pageType.vo';
import { FindPageByNameAndNvrIdQuery } from '../queries/findPageByNameAndNvrId.queryHandler';
import { VideoDevicesApiForDashboardService } from 'src/modules/videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForDashboard.service';

@Injectable()
export class PagesHttpService {
  constructor(
    private readonly mapper: PageMapper,
    private readonly serviceProvider: ServiceProvider,
    private readonly videoDevicesApiForDashboardService: VideoDevicesApiForDashboardService,
    private readonly pageRunningConfigService: PageRunningConfigService,
  ) {}
  async find(): Promise<GetAllPagesResponseDto> {
    const widgetPageEntities: PageEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllPagesQuery({
          filter: { type: PageTypes.WIDGET },
          orderBy: { column: 'pageIndex', status: OrderStates.ASCENDING },
        }),
      );
    return {
      widgetPages: await this.mapper.toResponseAll(widgetPageEntities),
    };
  }

  async findOne(id: string): Promise<PageResponseDto> {
    const pageEntity: PageEntity = await this.checkExistsPageWihtId(id);
    return this.mapper.toResponse(pageEntity);
  }

  async create(body: CreatePageRequestDto): Promise<string> {
    const nvr =
      await this.videoDevicesApiForDashboardService.checkNvrIsExistsAndActiveAndConnected(
        body.nvrId,
      );
    await this.checkAvoidPageDuplicationCreate(body.name, body.nvrId);
    const pageEntity: PageEntity = PageEntity.create(body);
    return await this.pageRunningConfigService.runConfigIfNotDuplicated(
      pageEntity,
      nvr.getProps().tenantId,
      PageConfigs.CREATE_PAGE,
      pageEntity.getProps(),
    );
  }

  async update(id: string, body: UpdatePageRequestDto): Promise<string> {
    const pageEntity: PageEntity = await this.checkExistsPageWihtId(id);
    const nvr =
      await this.videoDevicesApiForDashboardService.checkNvrIsExistsAndActiveAndConnected(
        pageEntity.getProps().nvrId,
      );
    if (body.name)
      await this.checkAvoidPageDuplicationUpdate(
        id,
        body.name,
        pageEntity.getProps().nvrId,
      );
    return await this.pageRunningConfigService.runConfigIfNotDuplicated(
      pageEntity,
      nvr.getProps().tenantId,
      PageConfigs.UPDATE_PAGE,
      { ...body, pageIndex: body.destIndex },
    );
  }

  async delete(id: string): Promise<string> {
    const pageEntity: PageEntity = await this.checkExistsPageWihtId(id);
    const nvr =
      await this.videoDevicesApiForDashboardService.checkNvrIsExistsAndActiveAndConnected(
        pageEntity.getProps().nvrId,
      );
    return await this.pageRunningConfigService.runConfigIfNotDuplicated(
      pageEntity,
      nvr.getProps().tenantId,
      PageConfigs.DELETE_PAGE,
    );
  }

  private async checkExistsPageWihtId(id: string) {
    const query = new FindPageByIdQuery(id);
    const pageEntity: PageEntity =
      await this.serviceProvider.queryBus.execute(query);
    if (!pageEntity)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.dashboard.errorResponse.badRequest.notExists,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    return pageEntity;
  }

  private async checkAvoidPageDuplicationCreate(name: string, nvrId: string) {
    const query = new FindPageByNameAndNvrIdQuery(name, nvrId);
    const pageEntity: PageEntity =
      await this.serviceProvider.queryBus.execute(query);
    if (pageEntity)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.dashboard.errorResponse.badRequest.nameIsDuplicated,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    return true;
  }

  private async checkAvoidPageDuplicationUpdate(
    id: string,
    name: string,
    nvrId: string,
  ) {
    const query = new FindPageByNameAndNvrIdQuery(name, nvrId);
    const pageEntity: PageEntity =
      await this.serviceProvider.queryBus.execute(query);
    if (pageEntity && pageEntity.id !== id)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.dashboard.errorResponse.badRequest.nameIsDuplicated,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    return true;
  }
}
