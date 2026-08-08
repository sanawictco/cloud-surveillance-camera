import { Mapper } from 'src/dddLib/infra';
import { Injectable } from '@nestjs/common';
import { EmployeeEntity } from '../../domain/entities/employee.entity';
import { EmployeeModel } from '../schemas/employee.schema';
import { EmployeeResponseDto } from '../../contracts/employee/employee.response.dto';
import { UserId } from '../../domain/valueObjects/userId.vo';
import { IsEmployeeDeleted } from '../../domain/valueObjects/isEmployeeDeleted.vo';
import { Roles } from '../../domain/valueObjects/employeeRole.vo';

@Injectable()
export class EmployeeMapper implements Mapper<
  EmployeeEntity,
  EmployeeModel,
  EmployeeResponseDto
> {
  toPersistence(entity: EmployeeEntity): EmployeeModel {
    const copy = entity.getProps();
    const record: EmployeeModel = {
      id: copy.id,
      userId: copy.userId,
      isDeleted: copy.isDeleted,
      roles: copy.roles,
      createdAt: copy.createdAt,
      updatedAt: copy.updatedAt,
    };
    return record;
  }

  toDomain(record: EmployeeModel): EmployeeEntity {
    const entity = new EmployeeEntity({
      id: record.id,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      props: {
        userId: new UserId(record.userId),
        isDeleted: new IsEmployeeDeleted(record.isDeleted),
        roles: new Roles(record.roles),
      },
    });
    return entity;
  }

  toResponse(entity: EmployeeEntity, externalProps: any): EmployeeResponseDto {
    const props = entity.getProps();
    return new EmployeeResponseDto(
      props.id,
      props.userId,
      props.roles,
      externalProps.firstName,
      externalProps.lastName,
      externalProps.phoneNumber,
      props.isDeleted,
      externalProps.isOwner,
      externalProps.lang,
      props.createdAt,
      props.updatedAt,
    );
  }

  toResponseAll(
    entities: EmployeeEntity[],
    externalProps: any,
  ): EmployeeResponseDto[] {
    const responseArr: EmployeeResponseDto[] = [];
    for (const [i, entity] of entities.entries()) {
      const externalProp = externalProps[i];
      if (!externalProp) {
        throw new Error(`Missing employee response data at index ${i}`);
      }
      responseArr.push(this.toResponse(entity, externalProp));
    }
    return responseArr;
  }
}
