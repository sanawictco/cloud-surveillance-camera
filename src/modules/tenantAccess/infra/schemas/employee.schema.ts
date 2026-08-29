import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { EmployeeProps } from '../../domain/types/employee.type';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';

@Schema({ collection: 'employees' })
export class EmployeeModel implements EmployeeProps {
  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ default: false, required: true })
  isDeleted: boolean;

  @Prop({ required: true, type: [String], enum: Object.values(EmployeeRoles) })
  roles: EmployeeRoles[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  constructor(props: Partial<EmployeeModel> = {}) {
    this.id = props.id ?? '';
    this.tenantId = props.tenantId ?? '';
    this.userId = props.userId ?? '';
    this.isDeleted = props.isDeleted ?? false;
    this.roles = props.roles ?? [];
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
export const EmployeeSchema = SchemaFactory.createForClass(EmployeeModel);

EmployeeSchema.index(
  { tenantId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { tenantId: { $type: 'string' } },
  },
);
EmployeeSchema.index({ userId: 1, isDeleted: 1 });
