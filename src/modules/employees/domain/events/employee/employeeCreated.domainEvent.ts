import { DomainEvent, DomainEventProps } from 'src/dddLib/core';
import { CreateEmployeeProps } from '../../types/employee.type';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';

export class EmployeeCreatedDomainEvent
  extends DomainEvent
  implements CreateEmployeeProps
{
  readonly userId: string;
  readonly roles: EmployeeRoles[];

  constructor(props: DomainEventProps<EmployeeCreatedDomainEvent>) {
    super(props);
    this.userId = props.userId;
    this.roles = props.roles;
  }
}
