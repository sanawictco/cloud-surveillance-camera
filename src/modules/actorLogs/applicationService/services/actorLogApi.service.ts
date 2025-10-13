import { Injectable } from '@nestjs/common';

import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { UserInfoDto } from 'src/extensions/userInfo/userInfo.dto';

import {
  ActorLogMessageProps,
  ActorLogTypes,
} from '../../domain/actorLog.type';
import { CreateActorLogCommand } from '../commands/createActorLog.command';
import { CreateActorLogSubTableCommand } from '../commands/createActorLogSubTable.command';
import { DeleteActorLogSubTableCommand } from '../commands/deleteActorLogSubTable.command';

@Injectable()
export class ActorLogApiService {
  constructor(private readonly serviceProvider: ServiceProvider) {}
  async registerActorLog(actorLogProps: {
    createdAt?: number;
    actorType?: ActorLogTypes;
    actorId?: string;
    messageProps: ActorLogMessageProps;
  }) {
    console.log(
      'catch actorLogProps in actorLog================================',
      actorLogProps,
    );
    const { messageProps } = actorLogProps;
    let { actorId, actorType, createdAt } = actorLogProps;
    actorType = actorType ? actorType : ActorLogTypes.EMPLOYEE;
    if (!actorId) {
      const userInfo: UserInfoDto =
        this.serviceProvider.userInfoService.getProps();
      actorId = userInfo ? userInfo.id : (undefined as any);
    }
    if (!actorId) return; // in cloudRecovery state and send hardwareConfigs automatically when replacedEndDevice applied
    createdAt = createdAt !== undefined ? createdAt : new Date().getTime();
    await this.serviceProvider.commandBus.execute(
      new CreateActorLogCommand({
        createdAt: createdAt,
        actorId: actorId,
        actorType: actorType || ActorLogTypes.EMPLOYEE,
        messageProps: messageProps,
      }),
    );
  }

  async createSubTable(subTableName: string) {
    await this.serviceProvider.commandBus.execute(
      new CreateActorLogSubTableCommand({ subTableName }),
    );
  }

  async deleteSubTable(subTableName: string) {
    await this.serviceProvider.commandBus.execute(
      new DeleteActorLogSubTableCommand({ subTableName }),
    );
  }

  async actorLogsDataReport(
    reportCase: string,
    actorType: any, //TODO
    fromDateTimeInUnix: number,
    toDateTimeInUnix: number,
    paginationOptions?: { page: number; limit: number },
  ) {}
}
