import { AggregateID } from 'src/dddLib/core';
import {
  Command,
  CommandProps,
} from 'src/dddLib/applicationService/command.base';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NVR_REPOSITORY } from '../../../infra/nvr/nvr.diToken';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';
import { MqttApiService } from 'src/extensions/mqtt/mqttApi.service';
import { NvrActorLogService } from '../../services/actorLogs/nvrActorLog.service';
import { SanawApiVideoDeviceService } from 'src/extensions/sanawApi/services/sanawApiVideoDevice.service';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { CreateNvrProps } from 'src/modules/videoDevices/domain/nvr/nvr.type';

export class CreateNvrCommand extends Command implements CreateNvrProps {
  readonly name: string;
  readonly workstationId: string;
  readonly serialNumber: string;
  readonly accessToken: string;
  readonly password: string;
  readonly maxCameras: number;

  constructor(props: CommandProps<CreateNvrCommand>) {
    super(props);
    this.name = props.name;
    this.workstationId = props.workstationId;
    this.serialNumber = props.serialNumber;
    this.accessToken = props.accessToken;
    this.password = props.password;
    this.maxCameras = props.maxCameras;
  }
}

@CommandHandler(CreateNvrCommand)
export class CreateNvrCommandHandler
  implements ICommandHandler<CreateNvrCommand>
{
  constructor(
    @Inject(NVR_REPOSITORY)
    private readonly nvrRepo: NvrRepository,
    private readonly sanawApiVideoDeviceService: SanawApiVideoDeviceService,
    private readonly mqttApiService: MqttApiService,
    private readonly nvrActorLogService: NvrActorLogService,
  ) {}

  async execute(command: CreateNvrCommand): Promise<AggregateID> {
    const nvr = NvrEntity.create({
      name: command.name,
      workstationId: command.workstationId,
      serialNumber: command.serialNumber,
      accessToken: command.accessToken,
      password: command.password,
      maxCameras: command.maxCameras,
    });
    await this.nvrRepo.insert(nvr);
    await this.processDependencies(nvr);
    return nvr.id;
  }

  private async processDependencies(nvrEntity: NvrEntity) {
    const { id, serialNumber, accessToken, workstationId } =
      nvrEntity.getProps();
    await this.sanawApiVideoDeviceService.useNvr(
      serialNumber,
      id,
      workstationId,
    );
    await this.mqttApiService.createNvrTopics(
      serialNumber,
      accessToken,
      nvrEntity.getAllMqttTopics(),
    );
    await this.nvrActorLogService.create({ nvrEntity });
  }
}
