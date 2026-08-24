import { Injectable } from '@nestjs/common';
import { BaseEntityProps } from 'src/dddLib/core';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { ActorPropsMsgIdDto } from 'src/modules/shared/dtos/actorPropsMsgId.dto';
import {
  CameraProps,
  CameraWebsocketConfigTypes,
} from 'src/modules/videoDevices/domain/camera/camera.type';
import { UpdateCameraCommand } from '../../commands/camera/updateCamera.command';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { FindCameraByIdQuery } from '../../queries/camera/findCameraById.queryHandler';
import { WebsocketService } from 'src/extensions/websocket/websocket.service';
import { CameraMapper } from 'src/modules/videoDevices/infra/camera/camera.mapper';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { UpdateCameraWsResponseDto } from 'src/modules/videoDevices/contracts/camera/websocket/updateCamera.wsResponse.dto';

@Injectable()
export class CameraMqttService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly websocketService: WebsocketService,
    private readonly cameraMapper: CameraMapper,
  ) {}
  async update(
    data: CameraProps & BaseEntityProps,
    metadata: ActorPropsMsgIdDto,
  ) {
    const { actorProps, msgId } = metadata;
    await this.serviceProvider.commandBus.execute(
      new UpdateCameraCommand({
        id: data.id,
        name: data.name,
        actorProps,
      }),
    );
    const updatedCameraEntity: CameraEntity =
      await this.serviceProvider.queryBus.execute(
        new FindCameraByIdQuery(data.id),
      );
    this.websocketService.sendMessage<UpdateCameraWsResponseDto>(
      this.websocketService.channels.VIDEO_DEVICES_SOCKET,
      {
        type: WebSocketTypes.CONFIG,
        data: this.cameraMapper.toResponse(updatedCameraEntity),
        message: { msgKey: LanguageKeys.camera.response.socket.updated },
        metadata: {
          configType: CameraWebsocketConfigTypes.UPDATE,
          msgId,
        },
      },
    );
  }
}
