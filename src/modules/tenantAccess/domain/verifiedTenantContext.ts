import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { TenantStatuses } from 'src/modules/tenants/domain/valueObjects/tenantStatus.vo';

export interface VerifiedTenantContext {
  userId: string;
  tenantId: string;
  tenantStatus: TenantStatuses;
  employeeId: string;
  roles: EmployeeRoles[];
  isOwner: boolean;
}
