import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

export class WorkstationDeletedDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps<WorkstationDeletedDomainEvent>) {
    super(props);
  }
}
