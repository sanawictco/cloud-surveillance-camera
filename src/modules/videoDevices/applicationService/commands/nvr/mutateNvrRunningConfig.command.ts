import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Command } from 'src/dddLib/applicationService/command.base';
import { NvrConfigs } from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';

type ProvisioningConfig = NvrConfigs.SEARCH | NvrConfigs.REGISTER;

export type NvrRunningConfigMutation =
  | { operation: 'set'; configType: string; msgId: string }
  | { operation: 'reset' }
  | {
      operation: 'claimProvisioning';
      configType: ProvisioningConfig;
      msgId: string;
    }
  | { operation: 'unsetIfMatches'; configType: string; msgId: string };

export class MutateNvrRunningConfigCommand extends Command {
  constructor(
    id: string,
    public readonly mutation: NvrRunningConfigMutation,
  ) {
    super({ id });
  }
}

@CommandHandler(MutateNvrRunningConfigCommand)
export class MutateNvrRunningConfigCommandHandler implements ICommandHandler<
  MutateNvrRunningConfigCommand,
  boolean
> {
  constructor(
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepository: NvrRepository,
  ) {}

  execute(command: MutateNvrRunningConfigCommand): Promise<boolean> {
    const { mutation } = command;
    switch (mutation.operation) {
      case 'set':
        return this.nvrRepository.setRunningConfig(
          command.id,
          mutation.configType,
          mutation.msgId,
        );
      case 'reset':
        return this.nvrRepository.resetRunningConfigs(command.id);
      case 'claimProvisioning':
        return this.nvrRepository.claimProvisioningConfig(
          command.id,
          mutation.configType,
          mutation.msgId,
        );
      case 'unsetIfMatches':
        return this.nvrRepository.unsetRunningConfigIfMatches(
          command.id,
          mutation.configType,
          mutation.msgId,
        );
    }
  }
}
