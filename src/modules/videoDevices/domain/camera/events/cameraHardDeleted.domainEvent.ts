import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

export class CameraHardDeletedDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps<CameraHardDeletedDomainEvent>) {
    super(props);
  }
}
