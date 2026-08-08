import { v4 } from 'uuid';
import { AggregateID, AggregateRoot } from 'src/dddLib/core';
import {
  CreateEmployeeProps,
  EmployeeProps,
  EmployeeValueObjects,
  UpdateEmployeeProps,
} from '../types/employee.type';
import { EmployeeCreatedDomainEvent } from '../events/employee/employeeCreated.domainEvent';
import { EmployeeHardDeletedDomainEvent } from '../events/employee/employeeHardDeleted.domainEvent';
import { EmployeeSoftDeletedDomainEvent } from '../events/employee/employeeSoftDeleted.domainEvent';
import { EmployeeUpdatedDomainEvent } from '../events/employee/employeeUpdated.domainEvent';
import { EmployeeRecoveredDomainEvent } from '../events/employee/employeeRecovered.domainEvent';
import { IsEmployeeDeleted } from '../valueObjects/isEmployeeDeleted.vo';
import { UserId } from '../valueObjects/userId.vo';
import { Roles } from '../valueObjects/employeeRole.vo';

export class EmployeeEntity extends AggregateRoot<
  EmployeeValueObjects,
  EmployeeProps
> {
  protected readonly _id: AggregateID;
  constructor(
    props: ConstructorParameters<
      typeof AggregateRoot<EmployeeValueObjects, EmployeeProps>
    >[0],
  ) {
    super(props);
    this._id = props.id;
  }

  static create(createEmployeeProps: CreateEmployeeProps): EmployeeEntity {
    const id = v4();
    const props: EmployeeValueObjects = {
      userId: new UserId(createEmployeeProps.userId),
      roles: new Roles(createEmployeeProps.roles),
      isDeleted: new IsEmployeeDeleted(false),
    };
    const employee = new EmployeeEntity({ id, props });
    try {
      employee.addEvent(
        new EmployeeCreatedDomainEvent({
          aggregateId: id,
          ...employee.getProps(),
        }),
      );
    } catch (error) {
      console.log(error);
    }

    return employee;
  }

  update(updateEmployeeProps: UpdateEmployeeProps) {
    const updateEmployeeValueObjects: Partial<EmployeeValueObjects> = {
      roles: this.createValueObjectIfDefined(updateEmployeeProps.roles, Roles),
      isDeleted: this.createValueObjectIfDefined(
        updateEmployeeProps.isDeleted,
        IsEmployeeDeleted,
      ),
    };
    const cleanedValueObjects = this.removeUndefinedProperties(
      updateEmployeeValueObjects,
    );
    const cleanedProps = this.removeUndefinedProperties(updateEmployeeProps);

    Object.assign(this.props, cleanedValueObjects);

    this.addEvent(
      new EmployeeUpdatedDomainEvent({
        ...cleanedProps,
        aggregateId: this.id,
      }),
    );
    return this;
  }

  softDelete(): void {
    this.props.isDeleted = new IsEmployeeDeleted(true);
    this.addEvent(
      new EmployeeSoftDeletedDomainEvent({
        aggregateId: this.id,
      }),
    );
  }

  hardDelete(): void {
    this.addEvent(
      new EmployeeHardDeletedDomainEvent({
        aggregateId: this.id,
      }),
    );
  }

  recovery(): void {
    this.props.isDeleted = new IsEmployeeDeleted(false);
    this.addEvent(
      new EmployeeRecoveredDomainEvent({
        aggregateId: this.id,
      }),
    );
  }
  validate(): void {}
}
