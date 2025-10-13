import { DomainEvent, DomainEventProps } from 'src/dddLib/core';
import { UpdateEmployeeProps } from '../../types/employee.type';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';

export class EmployeeUpdatedDomainEvent
  extends DomainEvent
  implements UpdateEmployeeProps
{
  readonly roles?: EmployeeRoles[];
  readonly isDeleted?: boolean;

  constructor(props: DomainEventProps<EmployeeUpdatedDomainEvent>) {
    super(props);
    this.roles = props.roles;
    this.isDeleted = props.isDeleted;
  }
}
