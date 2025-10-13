import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsPhoneNumber,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';

export class AddEmployeeRequestDto {
  @ApiProperty()
  @IsPhoneNumber('IR')
  phoneNumber: string;

  @ApiProperty({ enum: EmployeeRoles, isArray: true })
  @IsEnum(EmployeeRoles, { each: true })
  @ArrayMinSize(0)
  @ArrayMaxSize(5)
  roles: EmployeeRoles[];
}
