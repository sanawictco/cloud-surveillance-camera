import { DomainEvent, DomainEventProps } from 'src/dddLib/core';
import { CreateWorkstationProps } from '../workstation.type';

export class WorkstationCreatedDomainEvent
  extends DomainEvent
  implements CreateWorkstationProps
{
  readonly name: string;

  constructor(props: DomainEventProps<WorkstationCreatedDomainEvent>) {
    super(props);
    this.name = props.name;
  }
}
