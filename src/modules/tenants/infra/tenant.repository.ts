import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RepositoryBase } from 'src/dddLib/infra';
import { CacheService } from 'src/extensions/caching/cache.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { ParentRepository } from 'src/modules/shared/parent.repository';
import { TenantResponseDto } from '../contracts/tenant.response.dto';
import { TenantEntity } from '../domain/tenant.entity';
import { TenantValueObjects } from '../domain/tenant.type';
import { TenantMapper } from './tenant.mapper';
import { TenantModel } from './tenant.schema';

@Injectable()
export class TenantRepository
  extends ParentRepository<
    TenantModel,
    TenantValueObjects,
    TenantEntity,
    TenantResponseDto
  >
  implements RepositoryBase<TenantEntity>
{
  constructor(
    @InjectModel(TenantModel.name)
    protected readonly tenantModel: Model<TenantModel>,
    protected readonly mapper: TenantMapper,
    protected readonly cache: CacheService<TenantModel>,
    protected readonly serviceProvider: ServiceProvider,
  ) {
    super(tenantModel, TenantModel, mapper, cache, serviceProvider);
  }
}
