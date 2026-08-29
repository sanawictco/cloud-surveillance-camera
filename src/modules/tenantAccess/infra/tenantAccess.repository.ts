import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { TenantStatuses } from 'src/modules/tenants/domain/valueObjects/tenantStatus.vo';
import { TenantModel } from 'src/modules/tenants/infra/tenant.schema';

export interface TenantAccessRecord {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  status: TenantStatuses;
}

@Injectable()
export class TenantAccessRepository {
  constructor(
    @InjectModel(TenantModel.name)
    private readonly tenantModel: Model<TenantModel>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async findTenant(tenantId: string): Promise<TenantAccessRecord | undefined> {
    const tenant = await this.tenantModel
      .findOne({ id: tenantId })
      .lean<TenantModel>()
      .exec();
    return tenant ?? undefined;
  }

  findTenants(tenantIds: string[]): Promise<TenantAccessRecord[]> {
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

  async deleteSmsNotifier(tenantId: string, userId: string): Promise<void> {
    await this.connection
      .collection('smsNotifier')
      .deleteOne({ tenantId, userId });
  }
}
