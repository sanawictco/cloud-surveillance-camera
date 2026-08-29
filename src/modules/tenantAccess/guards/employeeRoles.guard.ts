import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';

const EMPLOYEE_ROLES_METADATA = 'employeeRoles';

export function RequireEmployeeRoles(...roles: EmployeeRoles[]) {
  return SetMetadata(EMPLOYEE_ROLES_METADATA, roles);
}

@Injectable()
export class EmployeeRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<EmployeeRoles[]>(
      EMPLOYEE_ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const tenant = RequestContextService.requireTenant();
    if (tenant.isOwner) return true;
    if (!requiredRoles.some((role) => tenant.roles.includes(role))) {
      throw new ForbiddenException(
        'employee role does not allow this operation',
      );
    }
    return true;
  }
}
