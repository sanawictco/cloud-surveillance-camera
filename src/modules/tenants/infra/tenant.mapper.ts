import { Injectable } from '@nestjs/common';
import { BusinessId } from 'src/dddLib/core/businessId.vo';
import { Mapper } from 'src/dddLib/infra';
import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { TenantResponseDto } from '../contracts/tenant.response.dto';
import { TenantEntity } from '../domain/tenant.entity';
import { DefaultTimezone } from '../domain/valueObjects/defaultTimezone.vo';
import { TenantStatus } from '../domain/valueObjects/tenantStatus.vo';
import { TenantModel } from './tenant.schema';

@Injectable()
export class TenantMapper implements Mapper<
  TenantEntity,
  TenantModel,
  TenantResponseDto
> {
  toPersistence(entity: TenantEntity): TenantModel {
    return entity.getProps();
  }

  toDomain(record: TenantModel): TenantEntity {
    return new TenantEntity({
      id: record.id,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      props: {
        ownerId: new BusinessId(record.ownerId),
        name: new Name(record.name),
        status: new TenantStatus(record.status),
        defaultTimezone: new DefaultTimezone(record.defaultTimezone),
      },
    });
  }

  toResponse(entity: TenantEntity): TenantResponseDto {
    return new TenantResponseDto(entity.getProps());
  }

  toResponseAll(entities: TenantEntity[]): TenantResponseDto[] {
    return entities.map((entity) => this.toResponse(entity));
  }
}
