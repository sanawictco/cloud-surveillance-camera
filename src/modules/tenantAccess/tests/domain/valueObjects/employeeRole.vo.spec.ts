import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { Roles } from '../../../domain/valueObjects/employeeRole.vo';

describe('Roles', () => {
  it('accepts the current device dashboard role from Sanaw API', () => {
    expect(new Roles([EmployeeRoles.Device_Dashboard]).unpack()).toEqual([
      EmployeeRoles.Device_Dashboard,
    ]);
  });
});
