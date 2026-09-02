import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

/**
 * Carries only the renamed value: the actor log is the sole consumer of a
 * camera update today. It deliberately does not claim to implement
 * UpdateCameraProps, which would imply it forwards every updated field.
 */
export class CameraUpdatedDomainEvent extends DomainEvent {
  readonly name?: string;

  constructor(props: DomainEventProps<CameraUpdatedDomainEvent>) {
    super(props);
    this.name = props.name;
  }
}
