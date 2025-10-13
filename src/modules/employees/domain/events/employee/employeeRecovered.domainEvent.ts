import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

export class EmployeeRecoveredDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps<EmployeeRecoveredDomainEvent>) {
    super(props);
  }
}
