import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { WorkstationProps } from '../domain/workstation.type';

@Schema({ collection: 'employees' })
export class WorkstationModel implements WorkstationProps {
  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: new Date() })
  createdAt: Date;

  @Prop({ default: new Date() })
  updatedAt: Date;
}
export const WorkstationSchema = SchemaFactory.createForClass(WorkstationModel);
