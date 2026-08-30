import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { WebsocketService } from 'src/extensions/websocket/websocket.service';
import { NvrRunningConfigService } from '../runningConfigs/nvrRunningConfig.service';
import { UpdateNvrCommand } from '../../commands/nvr/updateNvr.command';
import { ToConnectedNvrLiveSignalWsResponseDto } from '../../../contracts/nvr/websocket/toConnectedNvrLiveSignal.wsResponse.dto';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { ToDisconnectedNvrLiveSignalWsResponseDto } from '../../../contracts/nvr/websocket/toDisconnectedNvrLiveSignal.wsResponse.dto';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindAllCamerasForTenantQuery } from 'src/modules/videoDevices/applicationService/queries/camera/findAllCameras.queryHandler';
import { CameraLiveSignalService } from 'src/modules/videoDevices/applicationService/services/liveSignals/cameraLiveSignal.service';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { FindNvrByIdForTenantQuery } from 'src/modules/videoDevices/applicationService/queries/nvr/findNvrById.queryHandler';
import {
  legacyNvrLiveSignalSchedulerId,
  nvrLiveSignalSchedulerId,
} from 'src/extensions/scheduler/schedulerIds';
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
    const { tenantId } = nvrEntity.getProps();
    await this.serviceProvider.scheduler.setInterval(
      async () => {
        // Re-read the NVR under its persisted tenant on every tick so a long
        // lived schedule acts on current state, and pass that verified entity
        // (not the closure capture) into the config command.
        const current: NvrEntity | undefined =
          await this.serviceProvider.queryBus.execute(
            new FindNvrByIdForTenantQuery(tenantId, nvrEntity.id),
          );
        if (!current) {
          await this.stop(nvrEntity);
          return;
        }
        await this.nvrRunningConfigService.runConfigIfNotDuplicated(
          current,
          NvrConfigs.FOG_LIVE_SIGNAL,
          [],
        );
      },
      50_000,
      nvrLiveSignalSchedulerId(tenantId, nvrEntity.id),
    );
  }

  async toConnected(nvrEntity: NvrEntity) {
    const { tenantId } = nvrEntity.getProps();
    if (!nvrEntity.isConnected()) {
      await this.serviceProvider.commandBus.execute(
        new UpdateNvrCommand({
          id: nvrEntity.id,
          tenantId,
          liveSignalStatus: LiveSignalStatuses.CONNECTED,
        }),
      );
      const dependentCameraEntities: CameraEntity[] =
        await this.serviceProvider.queryBus.execute(
          new FindAllCamerasForTenantQuery(tenantId, {
            filter: {
              nvrId: nvrEntity.id,
              isActive: true,
              isDeleted: { $ne: true },
            },
          }),
        );
      for (const dependentCameraEntity of dependentCameraEntities) {
        await this.cameraLiveSignalService.toConnecting(dependentCameraEntity);
      }
    }
    this.websocketService.sendMessage<ToConnectedNvrLiveSignalWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
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
    const { tenantId } = nvrEntity.getProps();
    if (!nvrEntity.isDisconnected()) {
      await this.serviceProvider.commandBus.execute(
        new UpdateNvrCommand({
          id: nvrEntity.id,
          tenantId,
          liveSignalStatus: LiveSignalStatuses.DIS_CONNECTED,
        }),
      );

      await this.nvrRunningConfigService
        .doneAndUnlockConfig(nvrEntity)
        .catch((err) => {
          this.serviceProvider.logger.error(
            `NvrLiveSignal: failed to unlock runningConfigs on disconnect for ${nvrEntity.id}`,
            (err as Error)?.stack,
          );
        });

      const dependentCameraEntities: CameraEntity[] =
        await this.serviceProvider.queryBus.execute(
          new FindAllCamerasForTenantQuery(tenantId, {
            filter: {
              nvrId: nvrEntity.id,
              isActive: true,
              isDeleted: { $ne: true },
            },
          }),
        );
      for (const dependentCameraEntity of dependentCameraEntities) {
        await this.cameraLiveSignalService.toDisconnected(
          dependentCameraEntity,
        );
      }
      this.websocketService.sendMessage<ToDisconnectedNvrLiveSignalWsResponseDto>(
        this.websocketService.channels.VIDEO_DEVICES_SOCKET,
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
  }

  async stop(nvrEntity: NvrEntity) {
    const { tenantId } = nvrEntity.getProps();
    await this.serviceProvider.scheduler.remove(
      nvrLiveSignalSchedulerId(tenantId, nvrEntity.id),
    );
    // Also clear the pre-Phase-3 bare-nvrId schedule so an NVR deactivated
    // right after a deploy does not keep an orphaned live-signal interval
    // running under the old key.
    await this.serviceProvider.scheduler
      .remove(legacyNvrLiveSignalSchedulerId(nvrEntity.id))
      .catch(() => undefined);
  }
}
