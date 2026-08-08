import { EmployeeRoles } from './employeeRoles.enum';

export class SanawApiFindAllEmployeesResponseDto {
  statusCode: number;
  data: SanawApiEmployeeDto[];

  constructor(statusCode: number, data: SanawApiEmployeeDto[]) {
    this.statusCode = statusCode;
    this.data = data;
  }
}

export class SanawApiFindOneEmployeeResponseDto {
  statusCode: number;
  data: SanawApiEmployeeDto;

  constructor(statusCode: number, data: SanawApiEmployeeDto) {
    this.statusCode = statusCode;
    this.data = data;
  }
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

  constructor(
    userId: string,
    roles: EmployeeRoles[],
    firstName: string,
    lastName: string,
    phoneNumber: string,
    isOwner?: boolean,
  ) {
    this.userId = userId;
    this.roles = roles;
    this.firstName = firstName;
    this.lastName = lastName;
    this.phoneNumber = phoneNumber;
    this.isOwner = isOwner;
  }
}
