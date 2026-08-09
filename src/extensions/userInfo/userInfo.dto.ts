import { AggregateID } from 'src/dddLib/core';
import { EmployeeRoles } from '../sanawApi/dtos/employees/employeeRoles.enum';
import { LanguageCode } from '../translation/languageCode.enum';

export interface UserInfoDto {
  readonly id: AggregateID;
  readonly phoneNumber: string;
  readonly name: string;
  readonly roles: EmployeeRoles[];
  readonly lang: LanguageCode;
}
