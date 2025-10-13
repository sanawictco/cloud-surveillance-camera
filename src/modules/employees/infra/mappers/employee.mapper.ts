import { Mapper } from 'src/dddLib/infra';
import { Injectable } from '@nestjs/common';
import { EmployeeEntity } from '../../domain/entities/employee.entity';
import { EmployeeModel } from '../schemas/employee.schema';
import { EmployeeResponseDto } from '../../contracts/employee/employee.response.dto';
import { UserId } from '../../domain/valueObjects/userId.vo';
import { IsEmployeeDeleted } from '../../domain/valueObjects/isEmployeeDeleted.vo';
import { Roles } from '../../domain/valueObjects/employeeRole.vo';

@Injectable()
export class EmployeeMapper
  implements Mapper<EmployeeEntity, EmployeeModel, EmployeeResponseDto>
{
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
    const response = new EmployeeResponseDto(entity);
    response.userId = props.userId;
    response.roles = props.roles;
    response.isDeleted = props.isDeleted;
    response.firstName = externalProps.firstName;
    response.lastName = externalProps.lastName;
    response.phoneNumber = externalProps.phoneNumber;
    response.isOwner = externalProps.isOwner;

    return response;
  }

  toResponseAll(
    entities: EmployeeEntity[],
    externalProps: any,
  ): EmployeeResponseDto[] {
    const responseArr: EmployeeResponseDto[] = [];
    for (let i = 0; i < entities.length; i++) {
      const props = entities[i].getProps();
      const response = new EmployeeResponseDto(entities[i]);
      response.userId = props.userId;
      response.roles = props.roles;
      response.isDeleted = props.isDeleted;
      response.firstName = externalProps[i].firstName;
      response.lastName = externalProps[i].lastName;
      response.phoneNumber = externalProps[i].phoneNumber;
      response.isOwner = externalProps[i].isOwner;
      responseArr.push(response);
    }
    return responseArr;
  }
}
