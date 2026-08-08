import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PageProps } from '../../domain/page.type';
import { Widget } from '../../domain/valueObjects/pageContent.vo';
import { PageTypes } from '../../domain/valueObjects/pageType.vo';

@Schema({ collection: 'pages' })
export class PageModel implements PageProps {
  constructor(
    props: PageProps & { id: string; createdAt: Date; updatedAt: Date },
  ) {
    this.id = props.id;
    this.name = props.name;
    this.nvrId = props.nvrId;
    this.type = props.type;
    this.pageIndex = props.pageIndex;
    this.content = props.content;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.runningConfigs = props.runningConfigs;
  }

  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  nvrId: string;

  @Prop({ default: PageTypes.WIDGET, required: true })
  type: PageTypes;

  @Prop({ required: true })
  pageIndex: number;

  @Prop([Object])
  content: Widget[];

  @Prop({ default: new Date() })
  createdAt: Date;

  @Prop({ default: new Date() })
  updatedAt: Date;

  @Prop({ type: Object, required: true })
  runningConfigs: Record<string, string>;
}
export const PageSchema = SchemaFactory.createForClass(PageModel);
