import { DomainEvent, DomainEventProps } from 'src/dddLib/core';
import { UpdateTenantProps } from '../tenant.type';
import { TenantStatuses } from '../valueObjects/tenantStatus.vo';

export class TenantUpdatedDomainEvent
  extends DomainEvent
  implements UpdateTenantProps
{
  readonly name?: string;
  readonly slug?: string;
  readonly status?: TenantStatuses;
  readonly defaultTimezone?: string;

  constructor(props: DomainEventProps<TenantUpdatedDomainEvent>) {
    super(props);
    this.name = props.name;
    this.slug = props.slug;
    this.status = props.status;
    this.defaultTimezone = props.defaultTimezone;
  }
}
