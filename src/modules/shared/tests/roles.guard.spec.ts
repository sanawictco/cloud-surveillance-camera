import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
import { RolesGuardFactory } from '../roles.guard';

describe('RolesGuard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects a request with no authenticated context', () => {
    jest.spyOn(UserInfoService, 'getProps').mockReturnValue(undefined as never);
    const guard = RolesGuardFactory(EmployeeRoles.Camera_RuleChain_Dashboard);

    expect(() => guard.canActivate()).toThrow(UnauthorizedException);
  });

  it('rejects an authenticated employee without the camera role', () => {
    jest.spyOn(UserInfoService, 'getProps').mockReturnValue({
      roles: [EmployeeRoles.Employee],
    } as never);
    const guard = RolesGuardFactory(EmployeeRoles.Camera_RuleChain_Dashboard);

    expect(() => guard.canActivate()).toThrow(ForbiddenException);
  });

  it('accepts an authenticated employee with the camera role', () => {
    jest.spyOn(UserInfoService, 'getProps').mockReturnValue({
      roles: [EmployeeRoles.Camera_RuleChain_Dashboard],
    } as never);
    const guard = RolesGuardFactory(EmployeeRoles.Camera_RuleChain_Dashboard);

    expect(guard.canActivate()).toBe(true);
  });
});
