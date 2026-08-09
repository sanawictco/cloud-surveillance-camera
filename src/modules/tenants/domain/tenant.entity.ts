import { AggregateID, AggregateRoot, CreateEntityProps } from 'src/dddLib/core';
import { BusinessId } from 'src/dddLib/core/businessId.vo';
import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { v4 } from 'uuid';
import { TenantCreatedDomainEvent } from './events/tenantCreated.domainEvent';
import { TenantDeletedDomainEvent } from './events/tenantDeleted.domainEvent';
import { TenantUpdatedDomainEvent } from './events/tenantUpdated.domainEvent';
import {
  CreateTenantProps,
  TenantProps,
  TenantValueObjects,
  UpdateTenantProps,
} from './tenant.type';
import { DefaultTimezone } from './valueObjects/defaultTimezone.vo';
import { Slug } from './valueObjects/slug.vo';
import { TenantStatus, TenantStatuses } from './valueObjects/tenantStatus.vo';

export class TenantEntity extends AggregateRoot<
  TenantValueObjects,
  TenantProps
> {
  protected readonly _id: AggregateID;

  constructor(props: CreateEntityProps<TenantValueObjects>) {
    super(props);
    this._id = props.id;
  }

  static create(createTenantProps: CreateTenantProps): TenantEntity {
    const id = v4();
    const props: TenantValueObjects = {
      ownerId: new BusinessId(createTenantProps.ownerId),
      name: new Name(createTenantProps.name),
      slug: new Slug(createTenantProps.slug),
      status: new TenantStatus(createTenantProps.status),
      defaultTimezone: new DefaultTimezone(createTenantProps.defaultTimezone),
    };
    const tenant = new TenantEntity({ id, props });
    tenant.addEvent(
      new TenantCreatedDomainEvent({
        aggregateId: id,
        ...tenant.getProps(),
      }),
    );
    return tenant;
  }

  update(updateTenantProps: UpdateTenantProps): TenantEntity {
    const updateTenantValueObjects: Partial<TenantValueObjects> = {
      name: this.createValueObjectIfDefined(updateTenantProps.name, Name),
      slug: this.createValueObjectIfDefined(updateTenantProps.slug, Slug),
      status: this.createValueObjectIfDefined(
        updateTenantProps.status,
        TenantStatus,
      ),
      defaultTimezone: this.createValueObjectIfDefined(
        updateTenantProps.defaultTimezone,
        DefaultTimezone,
      ),
    };
    const cleanedValueObjects = this.removeUndefinedProperties(
      updateTenantValueObjects,
    );
    const cleanedProps = this.removeUndefinedProperties(updateTenantProps);

    Object.assign(this.props, cleanedValueObjects);
    this.addEvent(
      new TenantUpdatedDomainEvent({
        ...cleanedProps,
        aggregateId: this.id,
      }),
    );
    return this;
  }

  delete(): void {
    this.props.status = new TenantStatus(TenantStatuses.DECOMMISSIONED);
    this.addEvent(
      new TenantDeletedDomainEvent({
        aggregateId: this.id,
      }),
    );
  }

  validate(): void {}
}
