import { DomainEvent, DomainEventProps } from 'src/dddLib/core';

export class CameraCreatedDomainEvent extends DomainEvent {
  tenantId: string;
  name: string;
  productModel: string;
  serialNumber: string;
  hasPtz: boolean;
  hasAudio: boolean;
  nvrId: string;

  constructor(props: DomainEventProps<CameraCreatedDomainEvent>) {
    super(props);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.productModel = props.productModel;
    this.serialNumber = props.serialNumber;
    this.hasPtz = props.hasPtz;
    this.hasAudio = props.hasAudio;
    this.nvrId = props.nvrId;
  }
}
