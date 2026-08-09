import { LanguageCode } from 'src/extensions/translation/languageCode.enum';
import { EmployeeRoles } from './employeeRoles.enum';

export interface SanawApiFindAllEmployeesResponseDto {
  statusCode: number;
  data: SanawApiEmployeeDto[];
}

export interface SanawApiFindOneEmployeeResponseDto {
  statusCode: number;
  data: SanawApiEmployeeDto;
}

export interface SanawApiUpdateRoleEmployeeResponseDto {
  statusCode: number;
  data: SanawApiEmployeeDto;
}
export interface SanawApiAddEmployeeResponseDto {
  statusCode: number;
  data: SanawApiEmployeeDto;
}

export interface SanawApiEmployeeDto {
  userId: string;
  roles: EmployeeRoles[];
  firstName: string;
  lastName: string;
  phoneNumber: string;
  lang: LanguageCode;
  isOwner?: boolean;
}
