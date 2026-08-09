import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { WebsocketService } from 'src/extensions/websocket/websocket.service';
import { NvrRunningConfigService } from '../runningConfigs/nvrRunningConfig.service';
import { UpdateNvrCommand } from '../../commands/nvr/updateNvr.command';
import { ToConnectedNvrLiveSignalWsResponseDto } from '../../../contracts/nvr/websocket/toConnectedNvrLiveSignal.wsResponse.dto';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { ToDisconnectedNvrLiveSignalWsResponseDto } from '../../../contracts/nvr/websocket/toDisconnectedNvrLiveSignal.wsResponse.dto';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindAllCamerasQuery } from 'src/modules/videoDevices/applicationService/queries/camera/findAllCameras.queryHandler';
import { CameraLiveSignalService } from 'src/modules/videoDevices/applicationService/services/liveSignals/cameraLiveSignal.service';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import {
  NvrConfigs,
  NvrWebSocketDataTypes,
} from 'src/modules/videoDevices/domain/nvr/nvr.type';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

@Injectable()
export class NvrLiveSignalService {
  constructor(
    @Inject(forwardRef(() => NvrRunningConfigService))
    private readonly nvrRunningConfigService: NvrRunningConfigService,
    private readonly websocketService: WebsocketService,
    private readonly serviceProvider: ServiceProvider,
    private readonly cameraLiveSignalService: CameraLiveSignalService,
  ) {}

  async start(nvrEntity: NvrEntity) {
    await this.serviceProvider.scheduler.setInterval(
      async () => {
        await this.nvrRunningConfigService.runConfigIfNotDuplicated(
          nvrEntity,
          NvrConfigs.FOG_LIVE_SIGNAL,
          [],
        );
      },
      60_000,
      nvrEntity.id,
    );
  }

  async toConncted(nvrEntity: NvrEntity) {
    if (!nvrEntity.isConnected()) {
      await this.serviceProvider.commandBus.execute(
        new UpdateNvrCommand({
          id: nvrEntity.id,
          liveSignalStatus: LiveSignalStatuses.CONNECTED,
        }),
      );
    }
    this.websocketService.sendMessage<ToConnectedNvrLiveSignalWsResponseDto>(
      this.websocketService.channels.DEVICES_SOCKET,
      {
        type: WebSocketTypes.DATA,
        data: {
          id: nvrEntity.id,
          liveSignalStatus: LiveSignalStatuses.CONNECTED,
        },
        metadata: {
          dataType: NvrWebSocketDataTypes.LIVE_SIGNAL,
        },
      },
    );
  }

  async toDisconnected(nvrEntity: NvrEntity) {
    if (nvrEntity.isDisconnected()) return;
    await this.serviceProvider.commandBus.execute(
      new UpdateNvrCommand({
        id: nvrEntity.id,
        liveSignalStatus: LiveSignalStatuses.DIS_CONNECTED,
      }),
    );

    this.nvrRunningConfigService.doneAndUnLockConfig(nvrEntity);

    const dependentCameraEntities: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllCamerasQuery({
          filter: {
            tenantId: nvrEntity.getProps().tenantId,
            nvrId: nvrEntity.id,
            isActive: true,
          },
        }),
      );
    for (const dependentCameraEntity of dependentCameraEntities) {
      dependentCameraEntity.assertTenantMatches(nvrEntity);
      await this.cameraLiveSignalService.toDisconnected(dependentCameraEntity);
    }
    this.websocketService.sendMessage<ToDisconnectedNvrLiveSignalWsResponseDto>(
      this.websocketService.channels.DEVICES_SOCKET,
      {
        type: WebSocketTypes.DATA,
        data: {
          id: nvrEntity.id,
          liveSignalStatus: LiveSignalStatuses.DIS_CONNECTED,
        },
        metadata: {
          dataType: NvrWebSocketDataTypes.LIVE_SIGNAL,
        },
      },
    );
  }

  async stop(nvrEntity: NvrEntity) {
    await this.serviceProvider.scheduler.remove(nvrEntity.id);
  }
}
