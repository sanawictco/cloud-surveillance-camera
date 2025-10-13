import { DomainEvent, DomainEventProps } from 'src/dddLib/core';
import { UpdateWorkstationProps } from '../workstation.type';

export class WorkstationUpdatedDomainEvent
  extends DomainEvent
  implements UpdateWorkstationProps
{
  readonly name?: string;

  constructor(props: DomainEventProps<WorkstationUpdatedDomainEvent>) {
    super(props);
    this.name = props.name;
  }
}
