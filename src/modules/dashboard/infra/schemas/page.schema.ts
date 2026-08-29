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
    this.tenantId = props.tenantId;
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

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  nvrId: string;

  @Prop({
    default: PageTypes.WIDGET,
    required: true,
    type: String,
    enum: PageTypes,
  })
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
PageSchema.index({ tenantId: 1, id: 1 });
PageSchema.index({ tenantId: 1, nvrId: 1, type: 1, pageIndex: 1 });
PageSchema.index({ tenantId: 1, nvrId: 1, name: 1 });

/**
 * Single source of truth for the tenant-scoped page cache key. Every writer
 * and every evictor (including the fog restore path in another module) must
 * use this helper so the key format can never drift between them and leave
 * stale pages served from cache.
 */
export function pageCacheKey(tenantId: string, id: string): string {
  if (!tenantId) throw new Error('tenantId is required');
  return `tenant:${tenantId}:${PageModel.name}:${id}`;
}
