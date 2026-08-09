import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { Roles } from '../../../domain/valueObjects/employeeRole.vo';

describe('Roles', () => {
  it('accepts the current device dashboard role from Sanaw API', () => {
    expect(
      new Roles([EmployeeRoles.Device_RuleChain_Dashboard]).unpack(),
    ).toEqual([EmployeeRoles.Device_RuleChain_Dashboard]);
  });

  it('retains the legacy camera dashboard role for persisted records', () => {
    expect(
      new Roles([EmployeeRoles.Camera_RuleChain_Dashboard]).unpack(),
    ).toEqual([EmployeeRoles.Camera_RuleChain_Dashboard]);
  });
});
