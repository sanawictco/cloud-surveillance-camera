import { BadRequestException, Injectable } from '@nestjs/common';
import { AggregateID } from 'src/dddLib/core';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { CameraResponseDto } from 'src/modules/videoDevices/contracts/camera/http/camera.response.dto';
import { UpdateCameraRequestDto } from 'src/modules/videoDevices/contracts/camera/http/updateCamera.request.dto';
import { CameraEntity } from 'src/modules/videoDevices/domain/camera/camera.entity';
import { CameraSoftwareConfigs } from 'src/modules/videoDevices/domain/camera/camera.type';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';
import { CameraMapper } from 'src/modules/videoDevices/infra/camera/camera.mapper';
import { FindAllCamerasQuery } from '../../queries/camera/findAllCameras.queryHandler';
import { FindNvrByIdQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { CameraRunningConfigAndCommandService } from '../runningConfigs/cameraRunningConfigAndCommand.service';
import { CameraValidator } from '../validators/camera.validator';
import { NvrValidator } from '../validators/nvr.validator';
import { HardDeleteCameraCommand } from '../../commands/camera/hardDeleteCamera.command';

@Injectable()
export class CamerasHttpService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly mapper: CameraMapper,
    private readonly nvrValidator: NvrValidator,
    private readonly cameraRunningConfigAndCommandService: CameraRunningConfigAndCommandService,
    private readonly cameraValidator: CameraValidator,
  ) {}
  async find(): Promise<CameraResponseDto[]> {
    const query = new FindAllCamerasQuery({
      filter: { isDeleted: { $ne: true } },
    });
    const cameraEntity: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(query);
    return this.mapper.toResponseAll(cameraEntity);
  }

  async findOne(id: AggregateID): Promise<CameraResponseDto> {
    const cameraEntity = await this.cameraValidator.checkExistsCameraWihtId(id);
    return this.mapper.toResponse(cameraEntity);
  }

  async update(id: AggregateID, body: UpdateCameraRequestDto): Promise<string> {
    const cameraEntity = await this.cameraValidator.checkExistsCameraWihtId(id);
    this.cameraValidator.checkCameraShoudNotBeSoftDeleted(cameraEntity);
    if (body.name)
      await this.cameraValidator.checkAvoidCameraDuplicationUpdate(
        body.name,
        id,
      );

    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdQuery(cameraEntity.getProps().nvrId),
    );
    if (!nvrEntity)
      throw new BadRequestException(
        'end device is not connected to a nvr access point',
      );
    await this.nvrValidator.checkNvrShouldBeActiveAndHasConnectedStatus(
      nvrEntity,
    );
    return await this.cameraRunningConfigAndCommandService.runSoftwareConfigIfNotDuplicated(
      nvrEntity,
      cameraEntity,
      CameraSoftwareConfigs.UPDATE,
      { ...body },
    );
  }

  async hardDeleteCameras(ids: AggregateID[]) {
    for (const id of ids) {
      const cameraEntity =
        await this.cameraValidator.checkExistsCameraWihtId(id);
      this.cameraValidator.checkCameraShoudBeSoftDeleted(cameraEntity);
    }
    for (const id of ids) {
      await this.serviceProvider.commandBus.execute(
        new HardDeleteCameraCommand({ id }),
      );
    }
    return {
      data: { ids },
      message: {
        msgKey:
          ids.length > 1
            ? LanguageKeys.camera.response.socket.multiHardDeleted
            : LanguageKeys.camera.response.socket.hardDeleted,
      },
    };
  }
}
