import { CanActivate, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    _reflector: Reflector,
    private role: EmployeeRoles,
  ) {}

  canActivate(/*context: ExecutionContext*/): boolean {
    // const httpMethod = context.switchToHttp().getRequest().method;
    // const userHasOnlyViewRole = UserInfoService.getProps().roles.includes(
    //   EmployeeRoles.Only_View,
    // );
    // if (httpMethod === HttpMethods.GET && userHasOnlyViewRole) return true;
    if (UserInfoService.getProps().roles.includes(this.role)) return true;
    return false;
  }
}

export function RolesGuardFactory(role: EmployeeRoles) {
  return new RolesGuard(new Reflector(), role);
}
