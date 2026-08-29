import { ValueObject } from 'src/dddLib/core';
import { ArgumentInvalidException } from 'src/dddLib/core/exceptions';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';

export class Roles extends ValueObject<EmployeeRoles[]> {
  private _roles: EmployeeRoles[];
  constructor(roles: EmployeeRoles[]) {
    super();
    this._roles = roles;
    this.validate();
  }

  protected validate(): void {
    for (const role of this._roles) {
      if (!Object.values(EmployeeRoles).includes(role)) {
        throw new ArgumentInvalidException(
          `ValueObjectError: role=${role} which is not valid`,
        );
      }
    }
  }

  public unpack(): EmployeeRoles[] {
    return this._roles;
  }
}
