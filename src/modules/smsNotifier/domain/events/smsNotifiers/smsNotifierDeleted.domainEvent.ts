import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

export class SmsNotifierDeletedDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps<SmsNotifierDeletedDomainEvent>) {
    super(props);
  }
}
