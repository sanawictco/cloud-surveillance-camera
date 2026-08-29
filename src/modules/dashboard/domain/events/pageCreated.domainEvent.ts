import { DomainEvent, DomainEventProps } from 'src/dddLib/core';
import { CreatePageProps } from '../page.type';
import { Widget } from '../valueObjects/pageContent.vo';
import { PageTypes } from '../valueObjects/pageType.vo';

export class PageCreatedDomainEvent
  extends DomainEvent
  implements CreatePageProps
{
  readonly originId?: string;
  readonly tenantId: string;
  readonly nvrId: string;
  readonly name: string;
  readonly type: PageTypes;
  readonly pageIndex?: number;
  readonly content: Widget[];

  constructor(props: DomainEventProps<PageCreatedDomainEvent>) {
    super(props);
    this.tenantId = props.tenantId;
    this.nvrId = props.nvrId;
    this.name = props.name;
    this.type = props.type;
    this.pageIndex = props.pageIndex;
    this.content = props.content;
  }
}
