import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { ResponseBase } from 'src/dddLib/contracts/response.base';
import { AggregateID } from 'src/dddLib/core';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';

export class EmployeeResponseDto extends ResponseBase {
  constructor(
    public id: AggregateID,
    public userId: string,
    public roles: EmployeeRoles[],
    public firstName: string,
    public lastName: string,
    public phoneNumber: string,
    public isDeleted: boolean,
    public isOwner: boolean,
    public lang: LanguageCode,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super({ id, createdAt, updatedAt });
  }
}
