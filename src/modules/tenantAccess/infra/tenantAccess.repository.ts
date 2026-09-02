import { Injectable } from '@nestjs/common';
import { SmsNotifierApiForTenantAccessService } from 'src/modules/smsNotifier/applicatoinService/apiForAnotherServices/smsNotifierApiForTenantAccess.service';
import {
  TenantAccessView,
  TenantsApiForTenantAccessService,
} from 'src/modules/tenants/applicationService/apiForAnotherServices/tenantsApiForTenantAccess.service';

export type TenantAccessRecord = TenantAccessView;

/**
 * Reads tenant ownership/status and clears a removed member's SMS
 * subscription. Both live in other modules, so both go through that module's
 * *ApiFor<Consumer>Service facade rather than its schema or collection.
 */
@Injectable()
export class TenantAccessRepository {
  constructor(
    private readonly tenantsApi: TenantsApiForTenantAccessService,
    private readonly smsNotifierApi: SmsNotifierApiForTenantAccessService,
  ) {}

  findTenant(tenantId: string): Promise<TenantAccessRecord | undefined> {
    return this.tenantsApi.findTenant(tenantId);
  }

  findTenants(tenantIds: string[]): Promise<TenantAccessRecord[]> {
    return this.tenantsApi.findTenants(tenantIds);
  }

  tenantExists(tenantId: string): Promise<boolean> {
    return this.tenantsApi.tenantExists(tenantId);
  }

  findAllTenantIds(): Promise<string[]> {
    return this.tenantsApi.findAllTenantIds();
  }

  deleteSmsNotifier(tenantId: string, userId: string): Promise<void> {
    return this.smsNotifierApi.deleteForUser(tenantId, userId);
  }
}
