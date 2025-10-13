import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { EmployeeProps } from '../../domain/types/employee.type';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';

@Schema({ collection: 'employees' })
export class EmployeeModel implements EmployeeProps {
  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ default: false, required: true })
  isDeleted: boolean;

  @Prop({ type: [String], enum: Object.values(EmployeeRoles) })
  roles: EmployeeRoles[];

  @Prop({ default: new Date() })
  createdAt: Date;

  @Prop({ default: new Date() })
  updatedAt: Date;
}
export const EmployeeSchema = SchemaFactory.createForClass(EmployeeModel);
