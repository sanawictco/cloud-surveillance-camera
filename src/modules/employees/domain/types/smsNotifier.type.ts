import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';
import { UserId } from '../valueObjects/userId.vo';
import { SmsNotifierSystemLogTypes } from 'src/modules/employees/domain/valueObjects/smsNotifierSystemLogTypes';

export interface SmsNotifierValueObjects {
  userId: UserId;
  systemLogTypes: SmsNotifierSystemLogTypes;
}

export interface SmsNotifierProps {
  userId: string;
  systemLogTypes: SystemLogTypes[];
}

export interface CreateSmsNotifierProps {
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
