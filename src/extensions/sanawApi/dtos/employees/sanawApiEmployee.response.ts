import { EmployeeRoles } from './employeeRoles.enum';

export class SanawApiFindAllEmployeesResponseDto {
  statusCode: number;
  data: SanawApiEmployeeDto[];
}

export class SanawApiFindOneEmployeeResponseDto {
  statusCode: number;
  data: SanawApiEmployeeDto;
}

export class SanawApiUpdateRoleEmployeeResponseDto extends SanawApiFindOneEmployeeResponseDto {}
export class SanawApiAddEmployeeResponseDto extends SanawApiFindOneEmployeeResponseDto {}

class SanawApiEmployeeDto {
  userId: string;
  roles: EmployeeRoles[];
  firstName: string;
  lastName: string;
  phoneNumber: string;
  isOwner?: boolean;
}
