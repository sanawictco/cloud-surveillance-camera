import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Command,
  CommandProps,
  IdType,
} from 'src/dddLib/applicationService/command.base';
import { AggregateID } from 'src/dddLib/core';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';

import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';
import { NvrActorLogService } from '../../services/actorLogs/nvrActorLog.service';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import {
  NvrProps,
  UpdateNvrProps,
} from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

export class UpdateNvrCommand extends Command implements UpdateNvrProps {
  /**
   * Verified owning tenant. Optional only while the remaining synchronous
   * call sites are migrated; when present the handler restricts the update to
   * that tenant, so an async caller passing it cannot touch a foreign NVR.
   */
  readonly tenantId?: string;
  name?: string;
  password?: string;
  lang?: LanguageCode;
  liveSignalStatus?: LiveSignalStatuses;
  cloudIsRecovering?: boolean;
  runningConfigs?: Record<string, string>;

  constructor(props: CommandProps<UpdateNvrCommand> & IdType) {
    super(props);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.password = props.password;
    this.lang = props.lang;
    this.liveSignalStatus = props.liveSignalStatus;
    this.cloudIsRecovering = props.cloudIsRecovering;
    this.runningConfigs = props.runningConfigs;
  }
}

@CommandHandler(UpdateNvrCommand)
export class UpdateNvrCommandHandler implements ICommandHandler<UpdateNvrCommand> {
  constructor(
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepo: NvrRepository,
    @Inject(forwardRef(() => NvrActorLogService))
    private readonly nvrActorLogService: NvrActorLogService,
  ) {}

  async execute(command: UpdateNvrCommand): Promise<AggregateID> {
    const nvrEntity: NvrEntity | undefined = await this.nvrRepo.findById(
      command.id,
    );
    if (!nvrEntity) throw Error('not exist nvr with id');
    // A foreign-tenant NVR must be indistinguishable from a missing one.
    if (command.tenantId && nvrEntity.getProps().tenantId !== command.tenantId) {
      throw Error('not exist nvr with id');
    }
    const previousProps = nvrEntity.getProps(); // snapshot before mutation
    nvrEntity.update(this._toUpdateProps(command));
    await this.nvrRepo.update(nvrEntity);
    await this.processDependencies(nvrEntity, previousProps, command);
    return command.id;
  }

  private _toUpdateProps(command: UpdateNvrCommand): UpdateNvrProps {
    const {
      name,
      password,
      lang,
      liveSignalStatus,
      cloudIsRecovering,
      runningConfigs,
    } = command;

    return {
      name,
      password,
      lang,
      liveSignalStatus,
      cloudIsRecovering,
      runningConfigs,
    };
  }

  private async processDependencies(
    nvrEntity: NvrEntity,
    previousProps: NvrProps,
    command: UpdateNvrCommand,
  ) {
    const { name, password, lang, actorProps } = command;
    const changedProps: Partial<UpdateNvrProps> = {
      ...(name !== undefined && name !== previousProps.name && { name }),
      ...(password !== undefined &&
        password !== previousProps.password && { password }),
      ...(lang !== undefined && lang !== previousProps.lang && { lang }),
    };

    if (!Object.keys(changedProps).length) return;
    const actorId = actorProps?.actorId;
    if (!actorId) throw new Error('actorId does not exist');
    await this.nvrActorLogService.update({
      nvrEntity,
      actorId,
      updatedNvrProps: {
        currentOrOldName: previousProps.name,
        updatedProps: command,
      },
    });
  }
}
