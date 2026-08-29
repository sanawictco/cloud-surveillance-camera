import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';
import { UserId } from '../valueObjects/userId.vo';
import { SmsNotifierSystemLogTypes } from 'src/modules/smsNotifier/domain/valueObjects/smsNotifierSystemLogTypes';
import { BusinessId } from 'src/dddLib/core/businessId.vo';

export interface SmsNotifierValueObjects {
  tenantId: BusinessId;
  userId: UserId;
  systemLogTypes: SmsNotifierSystemLogTypes;
}

export interface SmsNotifierProps {
  tenantId: string;
  userId: string;
  systemLogTypes: SystemLogTypes[];
}

export interface CreateSmsNotifierProps {
  tenantId: string;
  userId: string;
  systemLogTypes: SystemLogTypes[];
}

export interface UpdateSmsNotifierProps {
  systemLogTypes: SystemLogTypes[];
}

export type SmsNotifierLanguageKeys = {
  smsNotifier: {
    actorLog: {
      added: string;
      updated: string;
      deleted: string;
    };
    response: {
      http: {
        added: string;
        updated: string;
        deleted: string;
      };
    };
    errorResponse: {
      badRequest: {
        alreadyExists: string;
        doesNotExists: string;
        phoneNumberShouldBelongToWorkspaceEmployees: string;
      };
    };
  };
};
