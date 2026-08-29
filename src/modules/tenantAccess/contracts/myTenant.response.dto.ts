import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { TenantStatuses } from 'src/modules/tenants/domain/valueObjects/tenantStatus.vo';

export class MyTenantResponseDto {
  tenantId: string;
  name: string;
  slug: string;
  status: TenantStatuses;
  employeeId: string;
  roles: EmployeeRoles[];
  isOwner: boolean;

  constructor(props: MyTenantResponseDto) {
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.slug = props.slug;
    this.status = props.status;
    this.employeeId = props.employeeId;
    this.roles = props.roles;
    this.isOwner = props.isOwner;
  }
}
