import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { WebsocketService } from 'src/extensions/websocket/websocket.service';
import { FindNvrByIdForTenantQuery } from 'src/modules/videoDevices/applicationService/queries/nvr/findNvrById.queryHandler';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { UpdateCameraCommand } from '../../commands/camera/updateCamera.command';
import { ToConnectedCameraLiveSignalWsResponseDto } from '../../../contracts/camera/websocket/toConnectedCameraLiveSignal.wsResponse.dto';
import { CameraEntity } from '../../../domain/camera/camera.entity';
import { CameraWebSocketDataTypes } from '../../../domain/camera/camera.type';
import { ToDisconnectedCameraLiveSignalWsResponseDto } from '../../../contracts/camera/websocket/toDisconnectedCameraLiveSignal.wsResponse.dto';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';
import { CameraRunningConfigAndCommandService } from '../runningConfigs/cameraRunningConfigAndCommand.service';
import { ToConnectingCameraLiveSignalWsResponseDto } from 'src/modules/videoDevices/contracts/camera/websocket/toConnectingCameraLiveSignal.wsResponse.dto';

@Injectable()
export class CameraLiveSignalService {
  constructor(
    private readonly websocketService: WebsocketService,
    private readonly serviceProvider: ServiceProvider,
    @Inject(forwardRef(() => CameraRunningConfigAndCommandService))
    private readonly CameraRunningConfigAndCommandService: CameraRunningConfigAndCommandService,
  ) {}

  async toConncted(cameraEntity: CameraEntity) {
    const { tenantId, nvrId } = cameraEntity.getProps();
    const nvrEntity: NvrEntity | undefined =
      await this.serviceProvider.queryBus.execute(
        new FindNvrByIdForTenantQuery(tenantId, nvrId),
      );
    if (!nvrEntity) return;
    cameraEntity.assertTenantMatches(nvrEntity);
    if (!nvrEntity.isConnected()) return;
    await this.serviceProvider.commandBus.execute(
      new UpdateCameraCommand({
        id: cameraEntity.id,
        tenantId,
        liveSignalStatus: LiveSignalStatuses.CONNECTED,
      }),
    );
    this.websocketService.sendMessage<ToConnectedCameraLiveSignalWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
      {
        type: WebSocketTypes.DATA,
        data: {
          id: cameraEntity.id,
          liveSignalStatus: LiveSignalStatuses.CONNECTED,
        },
        metadata: {
          dataType: CameraWebSocketDataTypes.LIVE_SIGNAL,
        },
      },
    );
  }

  async toConnecting(cameraEntity: CameraEntity) {
    await this.serviceProvider.commandBus.execute(
      new UpdateCameraCommand({
        id: cameraEntity.id,
        tenantId: cameraEntity.getProps().tenantId,
        liveSignalStatus: LiveSignalStatuses.CONNECTING,
      }),
    );
    this.websocketService.sendMessage<ToConnectingCameraLiveSignalWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
      {
        type: WebSocketTypes.DATA,
        data: {
          id: cameraEntity.id,
          liveSignalStatus: LiveSignalStatuses.CONNECTING,
        },
        metadata: {
          dataType: CameraWebSocketDataTypes.LIVE_SIGNAL,
        },
      },
    );
  }

  async toDisconnected(cameraEntity: CameraEntity) {
    if (cameraEntity.isDisconnected()) return;
    await this.serviceProvider.commandBus.execute(
      new UpdateCameraCommand({
        id: cameraEntity.id,
        tenantId: cameraEntity.getProps().tenantId,
        liveSignalStatus: LiveSignalStatuses.DIS_CONNECTED,
      }),
    );
    await this.CameraRunningConfigAndCommandService.doneAndUnLockConfig(
      cameraEntity,
    );
    this.websocketService.sendMessage<ToDisconnectedCameraLiveSignalWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
      {
        type: WebSocketTypes.DATA,
        data: {
          id: cameraEntity.id,
          liveSignalStatus: LiveSignalStatuses.DIS_CONNECTED,
        },
        metadata: {
          dataType: CameraWebSocketDataTypes.LIVE_SIGNAL,
        },
      },
    );
  }
}
