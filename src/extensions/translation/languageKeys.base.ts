import { CameraLanguageKeys } from 'src/modules/videoDevices/domain/camera/camera.type';
import { EmployeeLanguageKeys } from 'src/modules/tenantAccess/domain/types/employee.type';
import { SmsNotifierLanguageKeys } from 'src/modules/smsNotifier/domain/types/smsNotifier.type';
import { TenantLanguageKeys } from 'src/modules/tenants/domain/tenant.type';
import { PageLanguageKeys } from 'src/modules/dashboard/domain/page.type';
import { NvrLanguageKeys } from 'src/modules/videoDevices/domain/nvr/nvr.type';

export type LanguageKeysBase = OtherLanguageKeys &
  CameraLanguageKeys &
  EmployeeLanguageKeys &
  SmsNotifierLanguageKeys &
  TenantLanguageKeys &
  NvrLanguageKeys &
  PageLanguageKeys;

export const LanguageKeys: LanguageKeysBase = {
  camera: {
    actorLog: {
      created: 'camera.actorLog.created',
      deleted: 'camera.actorLog.deleted',
      activated: 'camera.actorLog.activated',
      inactivated: 'camera.actorLog.inactivated',
      nameUpdated: 'camera.actorLog.nameUpdated',
      recoveredFromTrash: 'camera.actorLog.recoveredFromTrash',
    },
    systemLog: {
      creationFailed: 'camera.systemLog.creationFailed',
      updateFailed: 'camera.systemLog.updateFailed',
      deletionFailed: 'camera.systemLog.deletionFailed',
    },
    response: {
      socket: {
        created: 'camera.response.socket.created',
        updated: 'camera.response.socket.updated',
        deleted: 'camera.response.socket.deleted',
        activated: 'camera.response.socket.activated',
        inactivated: 'camera.response.socket.inactivated',
        softDeleted: 'camera.response.socket.softDeleted',
        hardDeleted: 'camera.response.socket.hardDeleted',
        multiHardDeleted: 'camera.response.socket.multiHardDeleted',
      },
    },
    errorResponse: {
      badRequest: {
        nameIsDuplicated: 'camera.errorResponse.badRequest.nameIsDuplicated',
        isInactive: 'camera.errorResponse.badRequest.isInactive',
        liveSignalIsDisconnected:
          'camera.errorResponse.badRequest.liveSignalIsDisconnected',
        doesNotExists: 'camera.errorResponse.badRequest.doesNotExists',
        hasAlreadyActivated:
          'camera.errorResponse.badRequest.hasAlreadyActivated',
        hasAlreadyInactivated:
          'camera.errorResponse.badRequest.hasAlreadyInactivated',
        hasNoChange: 'camera.errorResponse.badRequest.hasNoChange',
        autoRegisterTimeout:
          'camera.errorResponse.badRequest.autoRegisterTimeout',
      },
    },
  },
  employee: {
    actorLog: {
      added: 'employee.actorLog.added',
      deleted: 'employee.actorLog.deleted',
      recovered: 'employee.actorLog.recovered',
      softDeleted: 'employee.actorLog.softDeleted',
      rolesUpdated: 'employee.actorLog.rolesUpdated',
    },
    response: {
      http: {
        added: 'employee.response.http.added',
        deleted: 'employee.response.http.deleted',
        rolesUpdated: 'employee.response.http.rolesUpdated',
        recovered: 'employee.response.http.recovered',
        softDeleted: 'employee.response.http.softDeleted',
      },
    },
    errorResponse: {
      badRequest: {
        softDeleted: 'employee.errorResponse.badRequest.softDeleted',
        alreadyAddedToWorkspace:
          'employee.errorResponse.badRequest.alreadyAddedToWorkspace',
        canNotUpdateSoftDeletedEmployees:
          'employee.errorResponse.badRequest.canNotUpdateSoftDeletedEmployees',
        onlySoftDeletedEmployeesCouldBeRecovered:
          'employee.errorResponse.badRequest.onlySoftDeletedEmployeesCouldBeRecovered',
        onlySoftDeletedEmployeesCouldBeHardDeleted:
          'employee.errorResponse.badRequest.onlySoftDeletedEmployeesCouldBeHardDeleted',
        shouldRecoverEmployeeFromTrashBeforeActivation:
          'employee.errorResponse.badRequest.shouldRecoverEmployeeFromTrashBeforeActivation',
        inactiveDependentRulechainsBeforeSoftDelete:
          'employee.errorResponse.badRequest.inactiveDependentRulechainsBeforeSoftDelete',
      },
    },
  },
  smsNotifier: {
    actorLog: {
      added: 'smsNotifier.actorLog.added',
      updated: 'smsNotifier.actorLog.updated',
      deleted: 'smsNotifier.actorLog.deleted',
    },
    response: {
      http: {
        added: 'smsNotifier.response.http.added',
        updated: 'smsNotifier.response.http.updated',
        deleted: 'smsNotifier.response.http.deleted',
      },
    },
    errorResponse: {
      badRequest: {
        alreadyExists: 'smsNotifier.errorResponse.badRequest.alreadyExists',
        doesNotExists: 'smsNotifier.errorResponse.badRequest.doesNotExists',
        phoneNumberShouldBelongToWorkspaceEmployees:
          'smsNotifier.errorResponse.badRequest.phoneNumberShouldBelongToWorkspaceEmployees',
      },
    },
  },

  tenant: {
    actorLog: {
      nameUpdated: 'tenant.actorLog.nameUpdated',
    },
    response: {
      http: {
        added: 'tenant.response.http.added',
        deleted: 'tenant.response.http.deleted',
        updated: 'tenant.response.http.updated',
      },
    },
    errorResponse: {
      badRequest: {
        nameIsDuplicated: 'tenant.errorResponse.badRequest.nameIsDuplicated',
      },
    },
  },
  nvr: {
    actorLog: {
      created: 'nvr.actorLog.created',
      deleted: 'nvr.actorLog.deleted',
      active: 'nvr.actorLog.active',
      inactive: 'nvr.actorLog.inactive',
      nameUpdated: 'nvr.actorLog.nameUpdated',
      passwordUpdated: 'nvr.actorLog.passwordUpdated',
      langUpdated: {
        toFa: 'nvr.actorLog.langUpdated.toFa',
        toEn: 'nvr.actorLog.langUpdated.toEn',
        toAr: 'nvr.actorLog.langUpdated.toAr',
        toKu: 'nvr.actorLog.langUpdated.toKu',
      },
    },
    systemLog: {
      updateFailed: 'nvr.systemLog.updateFailed',
      activationFailed: 'nvr.systemLog.activationFailed',
      inactivationFailed: 'nvr.systemLog.inactivationFailed',
      liveSignalFailed: 'nvr.systemLog.liveSignalFailed',
      recoverySucceeded: 'nvr.systemLog.recoverySucceeded',
    },
    response: {
      socket: {
        created: 'nvr.response.socket.created',
        updated: 'nvr.response.socket.updated',
        deleted: 'nvr.response.socket.deleted',
        activated: 'nvr.response.socket.activated',
        inactivated: 'nvr.response.socket.inactivated',
        startAutoRegisterProccessing:
          'nvr.response.socket.startAutoRegisterProccessing',
        allConnectedCamerasAreUpToDate:
          'nvr.response.socket.allConnectedCamerasAreUpToDate',
        multiCameraInactivated: 'nvr.response.socket.multiCameraInactivated',
        multiCameraActivated: 'nvr.response.socket.multiCameraActivated',
      },
    },
    errorResponse: {
      badRequest: {
        isNotActive: 'nvr.errorResponse.badRequest.isNotActive',
        nameIsDuplicated: 'nvr.errorResponse.badRequest.nameIsDuplicated',
        liveSignalFailed: 'nvr.errorResponse.badRequest.liveSignalFailed',
        hasAlreadyActivated: 'nvr.errorResponse.badRequest.hasAlreadyActivated',
        hasAlreadyInactivated:
          'nvr.errorResponse.badRequest.hasAlreadyInactivated',
        duplicatedNvr: 'nvr.errorResponse.badRequest.duplicatedNvr',
        camerasExceedsNvrCapacity:
          'nvr.errorResponse.badRequest.camerasExceedsNvrCapacity',
      },
    },
  },
  dashboard: {
    actorLog: {
      created: 'dashboard.actorLog.created',
      deleted: 'dashboard.actorLog.deleted',
      nameUpdated: 'dashboard.actorLog.nameUpdated',
      contentUpdated: 'dashboard.actorLog.contentUpdated',
      pageIndexUpdated: 'dashboard.actorLog.pageIndexUpdated',
    },
    systemLog: {
      deletionFailed: 'dashboard.systemLog.deletionFailed',
      updateFailed: 'dashboard.systemLog.updateFailed',
      createFailed: 'dashboard.systemLog.createFailed',
    },
    response: {
      http: {
        created: 'dashboard.response.http.created',
        updated: 'dashboard.response.http.updated',
      },
      socket: {
        created: 'dashboard.response.socket.created',
        updated: 'dashboard.response.socket.updated',
        deleted: 'dashboard.response.socket.deleted',
      },
    },
    errorResponse: {
      badRequest: {
        notExists: 'dashboard.errorResponse.badRequest.notExists',
        nameIsDuplicated: 'dashboard.errorResponse.badRequest.nameIsDuplicated',
      },
    },
  },
  others: {
    errorResponse: {
      badRequest: {
        wrongPassword: 'others.erroResponse.badRequest.wrongPassword',
        accessDenied: 'others.erroResponse.badRequest.accessDenied',
        invalidInput: 'others.erroResponse.badRequest.invalidInput',
        invalidRequest: 'others.erroResponse.badRequest.invalidRequest',
        invalidCmdStructures:
          'others.erroResponse.badRequest.invalidCmdStructures',
        configIsRunning: 'nvr.errorResponse.badRequest.configIsRunning',
      },
    },
    geo: {
      lat: 'others.geo.lat',
      lng: 'others.geo.lng',
      alt: 'others.geo.alt',
    },
    time: 'others.time',
    true: 'others.true',
    false: 'others.false',
    internalServerError: 'others.internalServerError',
  },
};

type OtherLanguageKeys = {
  others: {
    errorResponse: {
      badRequest: {
        wrongPassword: string;
        accessDenied: string;
        invalidInput: string;
        invalidRequest: string;
        invalidCmdStructures: string;
        configIsRunning: string;
      };
    };
    geo: {
      lat: string;
      lng: string;
      alt: string;
    };
    time: string;
    true: string;
    false: string;
    internalServerError: string;
  };
};
