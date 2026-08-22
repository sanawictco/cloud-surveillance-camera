import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

export class NvrCreatedDomainEvent extends DomainEvent {
  readonly name: string;
  readonly serialNumber: string;
  readonly tenantId: string;
  readonly productModel: string;
  readonly maxCameras: number;

  constructor(props: DomainEventProps<NvrCreatedDomainEvent>) {
    super(props);
    this.name = props.name;
    this.serialNumber = props.serialNumber;
    this.tenantId = props.tenantId;
    this.productModel = props.productModel;
    this.maxCameras = props.maxCameras;
  }
}
