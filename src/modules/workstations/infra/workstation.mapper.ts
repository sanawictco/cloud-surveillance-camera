import { Injectable } from '@nestjs/common';
import { Mapper } from 'src/dddLib/infra';
import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { WorkstationEntity } from '../domain/workstation.entity';
import { WorkstationModel } from './workstation.schema';
import { WorkstationResponseDto } from '../contracts/workstation.response.dto';

@Injectable()
export class WorkstationMapper implements Mapper<
  WorkstationEntity,
  WorkstationModel,
  WorkstationResponseDto
> {
  toPersistence(entity: WorkstationEntity): WorkstationModel {
    const copy = entity.getProps();
    const record: WorkstationModel = {
      id: copy.id,
      name: copy.name,
      createdAt: copy.createdAt,
      updatedAt: copy.updatedAt,
    };
    return record;
  }

  toDomain(record: WorkstationModel): WorkstationEntity {
    const entity = new WorkstationEntity({
      id: record.id,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      props: {
        name: new Name(record.name),
      },
    });
    return entity;
  }

  toResponse(entity: WorkstationEntity): WorkstationResponseDto {
    const props = entity.getProps();
    return new WorkstationResponseDto(props, props.name);
  }

  toResponseAll(entities: WorkstationEntity[]): WorkstationResponseDto[] {
    const responseArr: WorkstationResponseDto[] = [];
    for (const entity of entities) {
      responseArr.push(this.toResponse(entity));
    }
    return responseArr;
  }
}
