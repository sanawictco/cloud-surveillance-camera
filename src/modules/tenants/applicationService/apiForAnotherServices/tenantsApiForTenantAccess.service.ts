import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantStatuses } from '../../domain/valueObjects/tenantStatus.vo';
import { TenantModel } from '../../infra/tenant.schema';

/**
 * The slice of a tenant that tenantAccess needs to authorize a request.
 * Deliberately narrower than TenantEntity: consumers get ownership and status,
 * not the full aggregate.
 */
export interface TenantAccessView {
  id: string;
  ownerId: string;
  name: string;
  status: TenantStatuses;
}

/**
 * Producer-side facade for the tenantAccess module. Cross-module reads of the
 * tenants collection go through here so tenantAccess never binds to this
 * module's schema or repository directly.
 */
@Injectable()
export class TenantsApiForTenantAccessService {
  constructor(
    @InjectModel(TenantModel.name)
    private readonly tenantModel: Model<TenantModel>,
  ) {}

  async findTenant(tenantId: string): Promise<TenantAccessView | undefined> {
    const tenant = await this.tenantModel
      .findOne({ id: tenantId })
      .lean<TenantModel>()
      .exec();
    return tenant ?? undefined;
  }

  findTenants(tenantIds: string[]): Promise<TenantAccessView[]> {
    return this.tenantModel
      .find({ id: { $in: tenantIds } })
      .lean<TenantModel[]>()
      .exec();
  }

  async tenantExists(tenantId: string): Promise<boolean> {
    return Boolean(await this.tenantModel.exists({ id: tenantId }));
  }

  async findAllTenantIds(): Promise<string[]> {
    const tenants = await this.tenantModel
      .find()
      .select({ id: 1 })
      .lean<Array<{ id: string }>>()
      .exec();
    return tenants.map((tenant) => tenant.id);
  }
}
