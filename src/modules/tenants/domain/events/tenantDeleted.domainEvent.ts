import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

export class TenantDeletedDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps<TenantDeletedDomainEvent>) {
    super(props);
  }
}
