import { Injectable } from '@nestjs/common';

import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';

import {
  ActorLogMessageProps,
  ActorLogTypes,
} from '../../domain/actorLog.type';
import { CreateActorLogCommand } from '../commands/createActorLog.command';
import { DeleteTenantActorLogsCommand } from '../commands/deleteTenantActorLogs.command';

interface RegisterActorLogProps {
  /** Verified tenant. Required: the write is rejected without it. */
  tenantId: string;
  createdAt?: number;
  actorType?: ActorLogTypes;
  actorId?: string;
  messageProps: ActorLogMessageProps;
}

@Injectable()
export class ActorLogApiService {
  constructor(private readonly serviceProvider: ServiceProvider) {}

  /**
   * Registers one actor event for the given verified tenant. Synchronous
   * callers pass the active request's verified tenant; asynchronous callers
   * pass the persisted entity's or validated queue message's tenant. A tenant
   * supplied by a browser payload must never be forwarded here.
   */
  async registerActorLog(actorLogProps: RegisterActorLogProps): Promise<void> {
    const { tenantId, messageProps } = actorLogProps;
    let { actorId, actorType, createdAt } = actorLogProps;
    // In cloudRecovery state hardwareConfigs are sent automatically with no
    // authenticated actor; nothing attributable is written.
    if (!actorId && !UserInfoService.getProps()) return;
    actorType = actorType ? actorType : ActorLogTypes.EMPLOYEE;
    if (!actorId) {
      actorId = UserInfoService.getProps()!.id;
    }
    createdAt = createdAt !== undefined ? createdAt : new Date().getTime();
    await this.serviceProvider.commandBus.execute(
      new CreateActorLogCommand({
        tenantId,
        createdAt,
        actorId,
        actorType,
        messageProps,
      }),
    );
  }

  /**
   * Row-deletes the given actors' events inside `tenantId` only (per-member
   * hard delete). Deleting a whole tenant's actor history is a separate,
   * platform-authorized Phase 9 lifecycle operation — this method cannot do
   * it because the command requires explicit actor IDs.
   */
  async deleteActorLogs(tenantId: string, actorIds: string[]): Promise<void> {
    await this.serviceProvider.commandBus.execute(
      new DeleteTenantActorLogsCommand({ tenantId, actorIds }),
    );
  }
}
