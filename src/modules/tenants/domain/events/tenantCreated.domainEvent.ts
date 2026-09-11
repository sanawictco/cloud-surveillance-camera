import { DomainEvent, DomainEventProps } from 'src/dddLib/core';
import { CreateTenantProps } from '../tenant.type';
import { TenantStatuses } from '../valueObjects/tenantStatus.vo';

export class TenantCreatedDomainEvent
  extends DomainEvent
  implements CreateTenantProps
{
  readonly ownerId: string;
  readonly name: string;
  readonly status: TenantStatuses;
  readonly defaultTimezone: string;

  constructor(props: DomainEventProps<TenantCreatedDomainEvent>) {
    super(props);
    this.ownerId = props.ownerId;
    this.name = props.name;
    this.status = props.status;
    this.defaultTimezone = props.defaultTimezone;
  }
}
