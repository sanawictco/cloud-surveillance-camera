import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RepositoryBase } from 'src/dddLib/infra';
import { CacheService } from 'src/extensions/caching/cache.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { EmployeeResponseDto } from '../../contracts/employee/employee.response.dto';
import { EmployeeEntity } from '../../domain/entities/employee.entity';
import { EmployeeValueObjects } from '../../domain/types/employee.type';
import { EmployeeMapper } from '../mappers/employee.mapper';
import { EmployeeModel } from '../schemas/employee.schema';
import { Model } from 'mongoose';
import { ParentRepository } from 'src/modules/shared/parent.repository';

@Injectable()
export class EmployeeRepository
  extends ParentRepository<
    EmployeeModel,
    EmployeeValueObjects,
    EmployeeEntity,
    EmployeeResponseDto
  >
  implements RepositoryBase<EmployeeEntity>
{
  constructor(
    @InjectModel(EmployeeModel.name)
    protected readonly employeeModel: Model<EmployeeModel>,
    protected readonly mapper: EmployeeMapper,
    protected readonly cache: CacheService<EmployeeModel>,
    protected readonly serviceProvider: ServiceProvider,
  ) {
    super(employeeModel, EmployeeModel, mapper, cache, serviceProvider);
  }
}
