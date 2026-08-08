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

  constructor(props: Partial<WorkstationModel> = {}) {
    this.id = props.id ?? '';
    this.name = props.name ?? '';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
export const WorkstationSchema = SchemaFactory.createForClass(WorkstationModel);
