import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SmsNotifierProps } from '../../domain/types/smsNotifier.type';
import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';

@Schema({ collection: 'smsNotifier' })
export class SmsNotifierModel implements SmsNotifierProps {
  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ type: [String], enum: SystemLogTypes, required: true })
  systemLogTypes: SystemLogTypes[];

  @Prop({ default: new Date() })
  createdAt: Date;

  @Prop({ default: new Date() })
  updatedAt: Date;

  constructor(props: Partial<SmsNotifierModel> = {}) {
    this.id = props.id ?? '';
    this.tenantId = props.tenantId ?? '';
    this.userId = props.userId ?? '';
    this.systemLogTypes = props.systemLogTypes ?? [];
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
export const SmsNotifierSchema = SchemaFactory.createForClass(SmsNotifierModel);
SmsNotifierSchema.index(
  { tenantId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { tenantId: { $type: 'string' } },
  },
);
