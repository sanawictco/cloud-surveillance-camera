import {
  CanActivate,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
    const user = UserInfoService.getProps();
    if (!user) throw new UnauthorizedException();
    if (!user.roles.includes(this.role)) throw new ForbiddenException();
    return true;
  }
}

export function RolesGuardFactory(role: EmployeeRoles) {
  return new RolesGuard(new Reflector(), role);
}
