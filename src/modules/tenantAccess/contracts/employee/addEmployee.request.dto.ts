import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsPhoneNumber,
} from 'class-validator';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';

export class AddEmployeeRequestDto {
  @ApiProperty()
  @IsPhoneNumber('IR')
  phoneNumber!: string;

  @ApiProperty({ enum: EmployeeRoles, isArray: true })
  @IsEnum(EmployeeRoles, { each: true })
  @ArrayMinSize(0)
  @ArrayMaxSize(Object.keys(EmployeeRoles).length)
  roles!: EmployeeRoles[];
}
