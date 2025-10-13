import { Injectable } from '@nestjs/common';
import { Mapper } from 'src/dddLib/infra';
import { SmsNotifierEntity } from '../../domain/entities/smsNotifier.entity';
import { SmsNotifierModel } from '../schemas/smsNotifier.schema';
import { SmsNotifierResponseDto } from '../../contracts/smsNotifier/smsNotifier.response.dto';
import { SmsNotifierSystemLogTypes } from 'src/modules/employees/domain/valueObjects/smsNotifierSystemLogTypes';
import { UserId } from '../../domain/valueObjects/userId.vo';

@Injectable()
export class SmsNotifierMapper
  implements
    Mapper<SmsNotifierEntity, SmsNotifierModel, SmsNotifierResponseDto>
{
  toPersistence(entity: SmsNotifierEntity): SmsNotifierModel {
    const copy = entity.getProps();
    const record: SmsNotifierModel = {
      id: copy.id,
      userId: copy.userId,
      systemLogTypes: copy.systemLogTypes,
      createdAt: copy.createdAt,
      updatedAt: copy.updatedAt,
    };
    return record;
  }

  toDomain(record: SmsNotifierModel): SmsNotifierEntity {
    const entity = new SmsNotifierEntity({
      id: record.id,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      props: {
        userId: new UserId(record.userId),
        systemLogTypes: new SmsNotifierSystemLogTypes(record.systemLogTypes),
      },
    });
    return entity;
  }

  toResponse(
    entity: SmsNotifierEntity,
    externalProps: any,
  ): SmsNotifierResponseDto {
    const props = entity.getProps();
    const response = new SmsNotifierResponseDto(entity);
    response.phoneNumber = externalProps.phoneNumber;
    response.systemLogTypes = props.systemLogTypes;
    response.userId = props.userId;
    return response;
  }

  toResponseAll(
    entities: SmsNotifierEntity[],
    externalProps: any[],
  ): SmsNotifierResponseDto[] {
    const responseArr: SmsNotifierResponseDto[] = [];
    for (let i = 0; i < entities.length; i++) {
      const props = entities[i].getProps();
      const response = new SmsNotifierResponseDto(entities[i]);
      response.phoneNumber = externalProps[i].phoneNumber;
      response.systemLogTypes = props.systemLogTypes;
      response.userId = props.userId;
      responseArr.push(response);
    }
    return responseArr;
  }
}
