import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

export class EmployeeSoftDeletedDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps<EmployeeSoftDeletedDomainEvent>) {
    super(props);
  }
}
