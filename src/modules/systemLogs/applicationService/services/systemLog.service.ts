import { Injectable } from '@nestjs/common';
import { OrderStates } from 'src/dddLib/applicationService';
import { SanawApiNotificationService } from 'src/extensions/sanawApi/services/sanawApiNotification.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';
import { arabicSystemLogSections } from 'src/extensions/translation/languages/arabicValues';
import { englishSystemLogSections } from 'src/extensions/translation/languages/englishValues';
import { farsiSystemLogSections } from 'src/extensions/translation/languages/farsiValues';
import { kurdiSystemLogSections } from 'src/extensions/translation/languages/kurdiValues';
import { DictionarySections } from 'src/extensions/translation/translator.base';
import { WebsocketService } from 'src/extensions/websocket/websocket.service';
import { EmployeeApiForSystemLogsService } from 'src/modules/smsNotifier/applicatoinService/apiForAnotherServices/employeeApiForSystemLogs.service';
import { NotificationLevel } from '../../contracts/fogNotification/notificationLevel.enum';
import { CreateAndSendSystemLogWsResponseDto } from '../../contracts/systemLog/createAndSendSystemLog.wsResponse.dto';
import {
  CreateSystemLogProps,
  SystemLogTypes,
} from '../../domain/systemLog.type';
import { SystemLogWebSocketTypes } from '../../shares/systemLogWebSocketTypes.enum';
import { CreateSystemLogCommand } from '../commands/systemLog/createSystemLog.command';
import { DeleteAllSystemLogCommand } from '../commands/systemLog/deleteAllSystemLog.command';
import { FindAllPaginatedSystemLogsQuery } from '../queries/systemLog/findAllPaginatedSystemLogs.queryHandler';
import { GetAllSystemLogsRequestDto } from '../../contracts/systemLog/getAllSystemLogs.request.dto';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';

@Injectable()
export class SystemLogService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly websocketService: WebsocketService,
    private readonly sanawApiNotificationService: SanawApiNotificationService,
    private readonly employeeApiForSystemLogsService: EmployeeApiForSystemLogsService,
  ) {}

  async findAll(query: GetAllSystemLogsRequestDto) {
    const tenantId = UserInfoService.requireTenantId();
    let types: SystemLogTypes[] = JSON.parse(query.types ?? '[]');
    const page = query.page || 1;
    const limit = query.limit || 10;
    if (types.length === 0) {
      types = [
        SystemLogTypes.INFORMATION,
        SystemLogTypes.WARNING,
        SystemLogTypes.ERROR,
      ];
    }
    const systemLogs = await this.serviceProvider.queryBus.execute(
      new FindAllPaginatedSystemLogsQuery({
        tenantId,
        types,
        page,
        limit,
        orderBy: { column: 'createdAt', status: OrderStates.DESCENDING },
      }),
    );

    return {
      systemLogs,
    };
  }

  async getDictionary() {
    const lang: LanguageCode =
      this.serviceProvider.userInfoService.getProps().lang;
    const dictionary =
      this.serviceProvider.translatorService.prepareDictionaryFormatForEachSection(
        lang,
        DictionarySections.SYSTEM_LOG,
      );
    let sections;
    if (lang === LanguageCode.FA) {
      sections = farsiSystemLogSections;
    } else if (lang === LanguageCode.EN) {
      sections = englishSystemLogSections;
    } else if (lang === LanguageCode.AR) {
      sections = arabicSystemLogSections;
    } else if (lang === LanguageCode.KU) {
      sections = kurdiSystemLogSections;
    } else {
      throw new Error('unSupported Language');
    }
    return { dictionary: { ...dictionary, ...sections } };
  }

  async createAndSend(
    systemLogProps: CreateSystemLogProps,
    systemLogWebSocketType: SystemLogWebSocketTypes,
    metadata: {
      configType?: string;
      dataType?: string;
      widget?: { id: string };
      cmdKey?: string;
      msgId: string;
    },
  ) {
    await this.serviceProvider.commandBus.execute(
      new CreateSystemLogCommand(systemLogProps),
    );

    const { key, params } = systemLogProps.messageProps;
    const { translateByPattern, translateByName } =
      this.serviceProvider.translatorService;

    const data = {
      ...systemLogProps,
      message: { msgKey: key, msgParams: params as string[] },
    };

    this.websocketService.sendMessage<CreateAndSendSystemLogWsResponseDto>(
      this.websocketService.channels.SYSTEM_LOGS_SOCKET,
      {
        type: systemLogWebSocketType,
        data,
        metadata,
      },
    );

    const translateKey = (key: string, params?: (number | string)[]) => {
      return params ? translateByPattern(key, params) : translateByName(key);
    };
    await this.handleSmsNotifiers(
      systemLogProps.tenantId,
      translateKey(key, params),
      systemLogProps.type,
    );
  }

  async deleteSystemLogs(tenantId: string, id: string): Promise<void> {
    await this.serviceProvider.commandBus.execute(
      new DeleteAllSystemLogCommand({ tenantId, id }),
    );
  }

  async handleSmsNotifiers(
    tenantId: string,
    message: string,
    systemLogType: SystemLogTypes,
  ) {
    const smsNotifiers =
      await this.employeeApiForSystemLogsService.getSmsNotifiers(tenantId);
    for (const smsNotifier of smsNotifiers) {
      if (smsNotifier.systemLogTypes.includes(systemLogType)) {
        const level: string = systemLogType;
        let notificationLevel: NotificationLevel;
        switch (level) {
          case NotificationLevel.ERROR:
            notificationLevel = NotificationLevel.ERROR;
            break;
          case NotificationLevel.WARNING:
            notificationLevel = NotificationLevel.WARNING;
            break;

          case NotificationLevel.INFORMATION:
            notificationLevel = NotificationLevel.INFORMATION;
            break;
        }
        setTimeout(async () => {
          await this.sanawApiNotificationService.sms({
            level: notificationLevel,
            message,
            userId: smsNotifier.userId,
          });
          //TODO update systemLogNofityReport of the systemLog
        }, 0);
      }
    }
  }
}
