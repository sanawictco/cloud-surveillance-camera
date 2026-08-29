import { RequestContext } from 'nestjs-request-context';
import { UnauthorizedException } from '@nestjs/common';
import type { UserInfoDto } from 'src/extensions/userInfo/userInfo.dto';
import type { VerifiedTenantContext } from 'src/modules/tenantAccess/domain/verifiedTenantContext';
// Setting some isolated context for each request.

export class AppRequestContext extends RequestContext {
  requestId!: string;
  user?: UserInfoDto;
  tenant?: VerifiedTenantContext;
}

export class RequestContextService {
  static getContext(): AppRequestContext {
    const ctx: AppRequestContext = RequestContext.currentContext?.req;
    return ctx;
  }

  static setRequestId(id: string): void {
    const ctx = this.getContext();
    ctx.requestId = id;
  }

  static getRequestId(): string {
    return this.getContext()?.requestId;
  }

  static setTenant(tenant: VerifiedTenantContext): void {
    const ctx = this.getContext();
    if (!ctx) throw new UnauthorizedException('request context is unavailable');
    ctx.tenant = tenant;
  }

  static getTenant(): VerifiedTenantContext | undefined {
    return this.getContext()?.tenant;
  }

  static requireTenant(): VerifiedTenantContext {
    const tenant = this.getTenant();
    if (!tenant) throw new UnauthorizedException('verified tenant is required');
    return tenant;
  }

  static requireTenantId(): string {
    return this.requireTenant().tenantId;
  }
}
