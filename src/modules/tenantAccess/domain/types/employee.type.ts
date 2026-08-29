import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
export interface EmployeeProps {
  tenantId: string;
  userId: string;
  isDeleted: boolean;
  roles: EmployeeRoles[];
}

export interface EmployeeRecord extends EmployeeProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmployeeProps {
  tenantId: string;
  userId: string;
  roles: EmployeeRoles[];
}

export const EMPLOYEE_ACTION_LOG_SUPER_TABLE = 'employeeActionLogSuperTable';

export type EmployeeLanguageKeys = {
  employee: {
    actorLog: {
      added: string;
      deleted: string;
      recovered: string;
      softDeleted: string;
      rolesUpdated: string;
    };
    response: {
      http: {
        added: string;
        deleted: string;
        rolesUpdated: string;
        recovered: string;
        softDeleted: string;
      };
    };
    errorResponse: {
      badRequest: {
        softDeleted: string;
        alreadyAddedToWorkspace: string;
        canNotUpdateSoftDeletedEmployees: string;
        onlySoftDeletedEmployeesCouldBeRecovered: string;
        onlySoftDeletedEmployeesCouldBeHardDeleted: string;
        shouldRecoverEmployeeFromTrashBeforeActivation: string;
        inactiveDependentRulechainsBeforeSoftDelete: string;
      };
    };
  };
};
