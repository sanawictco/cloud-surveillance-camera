import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CacheService } from 'src/extensions/caching/cache.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { ParentRepository } from 'src/modules/shared/parent.repository';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';
import { NvrResponseDto } from '../../contracts/nvr/http/response/nvr.response.dto';
import { NvrValueObjects } from '../../../../../../cloud-surveillance-camera/src/modules/videoDevices/domain/nvr/nvr.type';
import { NvrEntity } from '../../../../../../cloud-surveillance-camera/src/modules/videoDevices/domain/nvr/nvr.entity';
import { NvrModel } from './nvr.schema';
import { NvrMapper } from './nvr.mapper';

@Injectable()
export class NvrRepository extends ParentRepository<
  NvrModel,
  NvrValueObjects,
  NvrEntity,
  NvrResponseDto
> {
  constructor(
    @InjectModel(NvrModel.name)
    protected readonly nvrModel: Model<NvrModel>,
    protected readonly mapper: NvrMapper,
    protected readonly cache: CacheService<NvrModel>,
    protected readonly serviceProvider: ServiceProvider,
  ) {
    super(nvrModel, NvrModel, mapper, cache, serviceProvider);
  }

  async restoreAndInitRecordsToCache(): Promise<void> {
    const nvrs = await this.nvrModel.find().lean();
    for (const nvr of nvrs) {
      nvr.runningConfigs = RunningConfigs.init().unpack();
      await this.nvrModel.updateOne({ id: nvr.id }, nvr);
      await this.cache.set(`${NvrModel.name}:${nvr.id}`, nvr);
    }
  }
}
