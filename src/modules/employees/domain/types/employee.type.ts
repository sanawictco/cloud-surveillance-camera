import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { IsEmployeeDeleted } from '../valueObjects/isEmployeeDeleted.vo';
import { UserId } from '../valueObjects/userId.vo';
import { Roles } from '../valueObjects/employeeRole.vo';

export interface EmployeeValueObjects {
  userId: UserId; // keycloak id
  isDeleted: IsEmployeeDeleted;
  roles: Roles;
}

export interface EmployeeProps {
  userId: string; // keycloak id
  isDeleted: boolean;
  roles: EmployeeRoles[];
}

export interface CreateEmployeeProps {
  userId: string;
  roles: EmployeeRoles[];
}

export interface UpdateEmployeeProps {
  roles?: EmployeeRoles[];
  isDeleted?: boolean;
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
