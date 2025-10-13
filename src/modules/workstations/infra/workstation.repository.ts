import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RepositoryBase } from 'src/dddLib/infra';
import { CacheService } from 'src/extensions/caching/cache.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';

import { Model } from 'mongoose';
import { WorkstationModel } from './workstation.schema';
import { ParentRepository } from 'src/modules/shared/parent.repository';
import { WorkstationValueObjects } from '../domain/workstation.type';
import { WorkstationEntity } from '../domain/workstation.entity';
import { WorkstationResponseDto } from '../contracts/workstation.response.dto';
import { WorkstationMapper } from './workstation.mapper';

@Injectable()
export class WorkstationRepository
  extends ParentRepository<
    WorkstationModel,
    WorkstationValueObjects,
    WorkstationEntity,
    WorkstationResponseDto
  >
  implements RepositoryBase<WorkstationEntity>
{
  constructor(
    @InjectModel(WorkstationModel.name)
    protected readonly workstationModel: Model<WorkstationModel>,
    protected readonly mapper: WorkstationMapper,
    protected readonly cache: CacheService<WorkstationModel>,
    protected readonly serviceProvider: ServiceProvider,
  ) {
    super(workstationModel, WorkstationModel, mapper, cache, serviceProvider);
  }
}
