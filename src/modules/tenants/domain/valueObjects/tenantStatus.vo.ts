import { ValueObject } from 'src/dddLib/core';
import { ArgumentInvalidException } from 'src/dddLib/core/exceptions';

export enum TenantStatuses {
  PROVISIONING = 'provisioning',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DECOMMISSIONING = 'decommissioning',
  DECOMMISSIONED = 'decommissioned',
}

export class TenantStatus extends ValueObject<TenantStatuses> {
  private readonly _status: TenantStatuses;

  constructor(status: TenantStatuses) {
    super();
    this._status = status;
    this.validate();
  }

  protected validate(): void {
    if (!Object.values(TenantStatuses).includes(this._status)) {
      throw new ArgumentInvalidException(
        `Tenant status=${this._status} is not valid`,
      );
    }
  }

  public unpack(): TenantStatuses {
    return this._status;
  }
}
