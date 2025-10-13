import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsEnum } from 'class-validator';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';

export class UpdateEmployeeRolesRequestDto {
  @ApiProperty()
  @IsEnum(EmployeeRoles, { each: true })
  @ArrayMinSize(0)
  @ArrayMaxSize(5)
  roles: EmployeeRoles[];
}
