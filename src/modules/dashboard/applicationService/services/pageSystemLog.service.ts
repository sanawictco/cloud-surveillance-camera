import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { SystemLogService } from 'src/modules/systemLogs/applicationService/services/systemLog.service';

import { SystemLogWebSocketTypes } from 'src/modules/systemLogs/shares/systemLogWebSocketTypes.enum';

import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import {
  SystemLogSections,
  SystemLogTypes,
} from 'src/modules/systemLogs/domain/systemLog.type';
import { PageEntity } from '../../domain/page.entity';
import { PageConfigs } from '../../domain/page.type';
import { ConfigTypeMsgIdDto } from 'src/modules/shared/dtos/configTypeMsgId.dto';

@Injectable()
export class PageSystemLogService {
  constructor(
    @Inject(forwardRef(() => SystemLogService))
    private readonly systemLogService: SystemLogService,
  ) {}
  async handle(pageEntity: PageEntity, metadata: ConfigTypeMsgIdDto) {
    switch (metadata.configType) {
      case PageConfigs.CREATE_PAGE:
        return await this.create(pageEntity, metadata);
      case PageConfigs.UPDATE_PAGE:
        return await this.update(pageEntity, metadata);
      case PageConfigs.DELETE_PAGE:
        return await this.delete(pageEntity, metadata);
      default:
        break;
    }
  }

  async create(pageEntity: PageEntity, metadata: ConfigTypeMsgIdDto) {
    await this.systemLogService.createAndSend(
      {
        type: SystemLogTypes.WARNING,
        messageProps: {
          key: LanguageKeys.dashboard.systemLog.createFailed,
          params: [pageEntity.getProps().name],
        },
        section: SystemLogSections.PAGE,
        entityId: pageEntity.id,
      },
      SystemLogWebSocketTypes.CONFIG,
      metadata,
    );
  }

  async update(pageEntity: PageEntity, metadata: ConfigTypeMsgIdDto) {
    await this.systemLogService.createAndSend(
      {
        type: SystemLogTypes.WARNING,
        messageProps: {
          key: LanguageKeys.dashboard.systemLog.updateFailed,
          params: [pageEntity.getProps().name],
        },
        section: SystemLogSections.PAGE,
        entityId: pageEntity.id,
      },
      SystemLogWebSocketTypes.CONFIG,
      metadata,
    );
  }

  async delete(pageEntity: PageEntity, metadata: ConfigTypeMsgIdDto) {
    await this.systemLogService.createAndSend(
      {
        type: SystemLogTypes.WARNING,
        messageProps: {
          key: LanguageKeys.dashboard.systemLog.deletionFailed,
          params: [pageEntity.getProps().name],
        },
        section: SystemLogSections.PAGE,
        entityId: pageEntity.id,
      },
      SystemLogWebSocketTypes.CONFIG,
      metadata,
    );
  }
}
