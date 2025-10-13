import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

export class EmployeeHardDeletedDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps<EmployeeHardDeletedDomainEvent>) {
    super(props);
  }
}
