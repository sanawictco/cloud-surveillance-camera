import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

export class CameraSoftDeletedDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps<CameraSoftDeletedDomainEvent>) {
    super(props);
  }
}
