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

export const EMPLOYEE_ROLES_METADATA = 'employeeRoles';
export const TENANT_OWNER_ONLY_METADATA = 'tenantOwnerOnly';

export function RequireEmployeeRoles(...roles: EmployeeRoles[]) {
  return SetMetadata(EMPLOYEE_ROLES_METADATA, roles);
}

// Handler-level override for operations that grant/hold privilege themselves
// (assigning roles, adding employees) — role membership is not sufficient
// there since any role holder could otherwise grant itself more roles.
export function RequireTenantOwner() {
  return SetMetadata(TENANT_OWNER_ONLY_METADATA, true);
}

@Injectable()
export class EmployeeRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const tenant = RequestContextService.requireTenant();

    const ownerOnly = this.reflector.getAllAndOverride<boolean>(
      TENANT_OWNER_ONLY_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (ownerOnly) {
      if (tenant.isOwner) return true;
      throw new ForbiddenException('only the tenant owner may perform this operation');
    }

    const requiredRoles = this.reflector.getAllAndOverride<EmployeeRoles[]>(
      EMPLOYEE_ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    if (tenant.isOwner) return true;
    if (!requiredRoles.some((role) => tenant.roles.includes(role))) {
      throw new ForbiddenException(
        'employee role does not allow this operation',
      );
    }
    return true;
  }
}
