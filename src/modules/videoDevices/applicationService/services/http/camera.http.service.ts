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
import { FindAllCamerasForTenantQuery } from '../../queries/camera/findAllCameras.queryHandler';
import { FindNvrByIdForTenantQuery } from '../../queries/nvr/findNvrById.queryHandler';
import { CameraRunningConfigAndCommandService } from '../runningConfigs/cameraRunningConfigAndCommand.service';
import { CameraValidator } from '../validators/camera.validator';
import { NvrValidator } from '../validators/nvr.validator';
import { HardDeleteCameraCommand } from '../../commands/camera/hardDeleteCamera.command';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';

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
    const tenantId = UserInfoService.requireTenantId();
    const query = new FindAllCamerasForTenantQuery(tenantId, {
      filter: { isDeleted: { $ne: true } },
    });
    const cameraEntity: CameraEntity[] =
      await this.serviceProvider.queryBus.execute(query);
    return this.mapper.toResponseAll(cameraEntity);
  }

  async findOne(id: AggregateID): Promise<CameraResponseDto> {
    const tenantId = UserInfoService.requireTenantId();
    const cameraEntity = await this.cameraValidator.checkExistsCameraWihtId(
      id,
      tenantId,
    );
    return this.mapper.toResponse(cameraEntity);
  }

  async update(id: AggregateID, body: UpdateCameraRequestDto): Promise<string> {
    const tenantId = UserInfoService.requireTenantId();
    const cameraEntity = await this.cameraValidator.checkExistsCameraWihtId(
      id,
      tenantId,
    );
    this.cameraValidator.checkCameraShoudNotBeSoftDeleted(cameraEntity);
    if (body.name)
      await this.cameraValidator.checkAvoidCameraDuplicationUpdate(
        body.name,
        id,
        tenantId,
      );

    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrByIdForTenantQuery(tenantId, cameraEntity.getProps().nvrId),
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
    const tenantId = UserInfoService.requireTenantId();
    for (const id of ids) {
      const cameraEntity = await this.cameraValidator.checkExistsCameraWihtId(
        id,
        tenantId,
      );
      this.cameraValidator.checkCameraShoudBeSoftDeleted(cameraEntity);
    }
    for (const id of ids) {
      await this.serviceProvider.commandBus.execute(
        new HardDeleteCameraCommand({ id, tenantId }),
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
