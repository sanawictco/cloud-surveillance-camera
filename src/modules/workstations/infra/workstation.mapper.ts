import { Injectable } from '@nestjs/common';
import { Mapper } from 'src/dddLib/infra';
import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { WorkstationEntity } from '../domain/workstation.entity';
import { WorkstationModel } from './workstation.schema';
import { WorkstationResponseDto } from '../contracts/workstation.response.dto';

@Injectable()
export class WorkstationMapper
  implements Mapper<WorkstationEntity, WorkstationModel, WorkstationResponseDto>
{
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
    const response = new WorkstationResponseDto(entity);
    response.name = props.name;

    return response;
  }

  toResponseAll(entities: WorkstationEntity[]): WorkstationResponseDto[] {
    const responseArr: WorkstationResponseDto[] = [];
    for (let i = 0; i < entities.length; i++) {
      const props = entities[i].getProps();
      const response = new WorkstationResponseDto(entities[i]);
      response.name = props.name;
      responseArr.push(response);
    }
    return responseArr;
  }
}
