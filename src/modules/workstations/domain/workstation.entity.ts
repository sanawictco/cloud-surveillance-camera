import { AggregateID, AggregateRoot } from 'src/dddLib/core';
import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { v4 } from 'uuid';
import { WorkstationCreatedDomainEvent } from './events/workstationCreated.domainEvent';
import { WorkstationDeletedDomainEvent } from './events/workstationDeleted.domainEvent';
import { WorkstationUpdatedDomainEvent } from './events/workstationUpdated.domainEvent';
import {
  CreateWorkstationProps,
  UpdateWorkstationProps,
  WorkstationProps,
  WorkstationValueObjects,
} from './workstation.type';

export class WorkstationEntity extends AggregateRoot<
  WorkstationValueObjects,
  WorkstationProps
> {
  protected readonly _id: AggregateID;
  constructor(
    props: ConstructorParameters<
      typeof AggregateRoot<WorkstationValueObjects, WorkstationProps>
    >[0],
  ) {
    super(props);
    this._id = props.id;
  }

  static create(
    createWorkstationProps: CreateWorkstationProps,
  ): WorkstationEntity {
    const id = v4();
    const props: WorkstationValueObjects = {
      name: new Name(createWorkstationProps.name),
    };
    const workstation = new WorkstationEntity({ id, props });
    try {
      workstation.addEvent(
        new WorkstationCreatedDomainEvent({
          aggregateId: id,
          ...workstation.getProps(),
        }),
      );
    } catch (error) {
      console.log(error);
    }

    return workstation;
  }

  update(updateWorkstationProps: UpdateWorkstationProps) {
    const updateWorkstationValueObjects: Partial<WorkstationValueObjects> = {
      name: this.createValueObjectIfDefined(updateWorkstationProps.name, Name),
    };
    const cleanedValueObjects = this.removeUndefinedProperties(
      updateWorkstationValueObjects,
    );
    const cleanedProps = this.removeUndefinedProperties(updateWorkstationProps);

    Object.assign(this.props, cleanedValueObjects);

    this.addEvent(
      new WorkstationUpdatedDomainEvent({
        ...cleanedProps,
        aggregateId: this.id,
      }),
    );
    return this;
  }

  delete(): void {
    this.addEvent(
      new WorkstationDeletedDomainEvent({
        aggregateId: this.id,
      }),
    );
  }

  validate(): void {}
}
