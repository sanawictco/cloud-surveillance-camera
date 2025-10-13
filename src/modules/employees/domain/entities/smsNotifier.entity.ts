import { v4 } from 'uuid';
import { AggregateID, AggregateRoot } from 'src/dddLib/core';
import {
  CreateSmsNotifierProps,
  SmsNotifierProps,
  SmsNotifierValueObjects,
  UpdateSmsNotifierProps,
} from '../types/smsNotifier.type';
import { SmsNotifierCreatedDomainEvent } from '../events/smsNotifiers/smsNotifierCreated.domainEvent';
import { SmsNotifierUpdatedDomainEvent } from '../events/smsNotifiers/smsNotifierUpdated.domainEvent';
import { SmsNotifierDeletedDomainEvent } from '../events/smsNotifiers/smsNotifierDeleted.domainEvent';
import { UserId } from '../valueObjects/userId.vo';
import { SmsNotifierSystemLogTypes } from 'src/modules/employees/domain/valueObjects/smsNotifierSystemLogTypes';

export class SmsNotifierEntity extends AggregateRoot<
  SmsNotifierValueObjects,
  SmsNotifierProps
> {
  protected readonly _id: AggregateID;
  static create(
    createSmsNotifierProps: CreateSmsNotifierProps,
  ): SmsNotifierEntity {
    const id = v4();
    const props: SmsNotifierValueObjects = {
      userId: new UserId(createSmsNotifierProps.userId),
      systemLogTypes: new SmsNotifierSystemLogTypes(
        createSmsNotifierProps.systemLogTypes,
      ),
    };
    const smsNotifierEntity = new SmsNotifierEntity({ id, props });
    smsNotifierEntity.addEvent(
      new SmsNotifierCreatedDomainEvent({
        aggregateId: id,
        ...smsNotifierEntity.getProps(),
      }),
    );
    return smsNotifierEntity;
  }

  update(updateSmsNotifierProps: UpdateSmsNotifierProps) {
    this.props.systemLogTypes = new SmsNotifierSystemLogTypes(
      updateSmsNotifierProps.systemLogTypes,
    );

    this.addEvent(
      new SmsNotifierUpdatedDomainEvent({
        ...updateSmsNotifierProps,
        aggregateId: this.id,
      }),
    );
    return this;
  }

  delete(): void {
    this.addEvent(
      new SmsNotifierDeletedDomainEvent({
        aggregateId: this.id,
      }),
    );
  }

  validate(): void {}
}
