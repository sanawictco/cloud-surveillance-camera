import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PageConfigs } from '../../domain/page.type';
import { PAGE_REPOSITORY } from '../../infra/diTokens/page.diToken';
import { PageRepository } from '../../infra/repositories/page.repository';

export class UnlockPageRunningConfigCommand {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
    public readonly nvrId: string,
    public readonly configType: PageConfigs,
    public readonly msgId: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}

@CommandHandler(UnlockPageRunningConfigCommand)
export class UnlockPageRunningConfigCommandHandler implements ICommandHandler<UnlockPageRunningConfigCommand> {
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepository: PageRepository,
  ) {}

  execute(command: UnlockPageRunningConfigCommand): Promise<boolean> {
    return this.pageRepository.unlockRunningConfig(
      command.tenantId,
      command.id,
      command.nvrId,
      command.configType,
      command.msgId,
    );
  }
}
