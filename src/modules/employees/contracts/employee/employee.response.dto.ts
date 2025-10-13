import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { ResponseBase } from 'src/dddLib/contracts/response.base';

export class EmployeeResponseDto extends ResponseBase {
  userId: string;
  roles: EmployeeRoles[];
  firstName: string;
  lastName: string;
  phoneNumber: string;
  isDeleted: boolean;
  isOwner: boolean;
}
