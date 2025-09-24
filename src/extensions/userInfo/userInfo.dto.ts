import { EmployeeRoles } from '../sanawApi/dtos/employees/employeeRoles.enum';
import { LanguageCode } from '../translation/languageCode.enum';

export class UserInfoDto {
  id: string;
  phoneNumber: string;
  name: string;
  roles: EmployeeRoles[];
  lang: LanguageCode;
}
