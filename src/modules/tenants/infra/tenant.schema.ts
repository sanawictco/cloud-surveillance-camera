import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TenantProps } from '../domain/tenant.type';
import { TenantStatuses } from '../domain/valueObjects/tenantStatus.vo';

@Schema({ collection: 'tenants' })
export class TenantModel implements TenantProps {
  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, type: String, enum: Object.values(TenantStatuses) })
  status: TenantStatuses;

  @Prop({ required: true })
  defaultTimezone: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  constructor(props: Partial<TenantModel> = {}) {
    this.id = props.id ?? '';
    this.ownerId = props.ownerId ?? '';
    this.name = props.name ?? '';
    this.status = props.status ?? TenantStatuses.PROVISIONING;
    this.defaultTimezone = props.defaultTimezone ?? '';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}

export const TenantSchema = SchemaFactory.createForClass(TenantModel);
// One owner cannot create two tenants sharing the same name; there is no
// per-tenant uniqueness requirement on name across different owners.
TenantSchema.index({ ownerId: 1, name: 1 }, { unique: true });
