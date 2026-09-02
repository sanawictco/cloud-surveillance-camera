import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RepositoryBase } from 'src/dddLib/infra';
import { CacheService } from 'src/extensions/caching/cache.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { CameraModel } from './camera.schema';
import { CameraValueObjects } from '../../domain/camera/camera.type';
import { CameraEntity } from '../../domain/camera/camera.entity';
import { ParentRepository } from 'src/modules/shared/parent.repository';
import { CameraMapper } from './camera.mapper';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';
import { CameraResponseDto } from '../../contracts/camera/http/camera.response.dto';

@Injectable()
export class CameraRepository
  extends ParentRepository<
    CameraModel,
    CameraValueObjects,
    CameraEntity,
    CameraResponseDto
  >
  implements RepositoryBase<CameraEntity>
{
  constructor(
    @InjectModel(CameraModel.name)
    protected readonly cameraModel: Model<CameraModel>,
    protected readonly mapper: CameraMapper,
    protected readonly cache: CacheService<CameraModel>,
    protected readonly serviceProvider: ServiceProvider,
  ) {
    super(cameraModel, CameraModel, mapper, cache, serviceProvider);
  }

  async restoreAndInitRecordsToCache(): Promise<void> {
    const cameras = await this.cameraModel.find().lean();
    for (const camera of cameras) {
      camera.runningConfigs = RunningConfigs.init().unpack();
      await this.cameraModel.updateOne({ id: camera.id }, camera);
      await this.cache.set(`${CameraModel.name}:${camera.id}`, camera);
    }
  }

  // Tenant scope is mandatory: a running-config mutation must never be able to
  // reach another tenant's camera by bare id.
  async unsetRunningConfigIfMatches(
    cameraId: string,
    configType: string,
    msgId: string,
    tenantId: string,
  ): Promise<boolean> {
    const path = `runningConfigs.${configType}`;
    const record = await this.cameraModel
      .findOneAndUpdate(
        { $and: [{ tenantId }, { id: cameraId }, { [path]: msgId }] },
        {
          $unset: { [path]: '' },
          $currentDate: { updatedAt: true },
        },
        { new: true },
      )
      .lean();
    if (!record) return false;
    await this.cache.delete(`${CameraModel.name}:${record.id}`);
    return true;
  }
}
