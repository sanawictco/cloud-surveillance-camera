import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { isUUID } from 'class-validator';
import { RequestContextService } from 'src/dddLib/utils/appRequestContext';
import { TenantAccessService } from '../applicationService/tenantAccess.service';

@Injectable()
export class ActiveTenantGuard implements CanActivate {
  constructor(private readonly tenantAccessService: TenantAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException();

    const tenantHeader = request.headers['x-tenant-id'];
    if (Array.isArray(tenantHeader) || !tenantHeader) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }
    if (!isUUID(tenantHeader, '4')) {
      throw new BadRequestException('X-Tenant-Id header must be a UUID');
    }

    const access = await this.tenantAccessService.resolveActiveAccess(
      tenantHeader,
      userId,
    );
    if (!access) throw new ForbiddenException('tenant access denied');

    RequestContextService.setTenant(access);
    return true;
  }
}
