import { isUUID } from 'class-validator';

export interface SystemLogProps {
  tenantId: string;
  createdAt: number;
  type: SystemLogTypes;
  messageProps: SystemLogMessageProps;
  section: SystemLogSections;
  entityId: string;
}

export class SystemLogMessageProps {
  constructor(
    public key: string,
    public params?: (number | string)[],
  ) {}
}

export interface CreateSystemLogProps {
  tenantId: string;
  type: SystemLogTypes;
  messageProps: SystemLogMessageProps;
  section: SystemLogSections;
  entityId: string;
}
export interface SendSystemLogOnWebSocketProps {
  tenantId: string;
  type: SystemLogTypes;
  section: SystemLogSections;
  message?: string | { msgKey: string; msgParams?: string[] };
  entityId: string;
}

export enum SystemLogTypes {
  ERROR = 'error',
  WARNING = 'warning',
  INFORMATION = 'information',
}

export enum SystemLogSections {
  VIDEO_DEVICES_CONFIG = 'SYSTEM_LOG_SECTION_VIDEO_DEVICES_CONFIG',
  VIDEO_DEVICES_LIVE_SIGNAL = 'SYSTEM_LOG_SECTION_VIDEO_DEVICES_LIVE_SIGNAL',
  PAGE = 'SYSTEM_LOG_SECTION_PAGE',
}

export class SystemLogNotifyStatus {
  constructor(
    public phoneNumber: string,
    public delivered: boolean,
  ) {}
}

export type SystemLogRecordFormat = [
  string,
  SystemLogMessageProps,
  SystemLogSections,
  string,
];

export const SYSTEM_LOG_SUPER_TABLE = 'systemLogDetailV2';

export const SYSTEM_LOG_MESSAGE_KEYS_COLUMN_SIZE = 200;
export const SYSTEM_LOG_MESSAGE_PARAMS_COLUMN_SIZE = 500;
export const SYSTEM_LOG_SECTION_COLUMN_SIZE = 50;
export const SYSTEM_LOG_ENTITY_ID_COLUMN_SIZE = 50;
export const SYSTEM_LOG_TENANT_ID_COLUMN_SIZE = 36;

export const systemLogColumnNames: string[] = [
  'createdAt',
  'messageKey',
  'messageParams',
  'section',
  'entityId',
];

export const systemLogColumnTypes: string[] = [
  'TIMESTAMP',
  `VARCHAR(${SYSTEM_LOG_MESSAGE_KEYS_COLUMN_SIZE})`,
  `VARCHAR(${SYSTEM_LOG_MESSAGE_PARAMS_COLUMN_SIZE})`,
  `VARCHAR(${SYSTEM_LOG_SECTION_COLUMN_SIZE})`,
  `VARCHAR(${SYSTEM_LOG_ENTITY_ID_COLUMN_SIZE})`,
];

export const systemLogSelectedColumns = [...systemLogColumnNames, 'groupId'];

export function assertSystemLogTenantId(tenantId: string): void {
  if (!isUUID(tenantId, '4')) throw new Error('tenantId must be a UUID v4');
}

export function assertSystemLogTypes(types: SystemLogTypes[]): void {
  if (
    !Array.isArray(types) ||
    types.some((type) => !Object.values(SystemLogTypes).includes(type))
  ) {
    throw new Error('system log type is invalid');
  }
}

export function systemLogSubTableName(
  tenantId: string,
  type: SystemLogTypes,
): string {
  assertSystemLogTenantId(tenantId);
  assertSystemLogTypes([type]);
  return `system_log_t_${tenantId.replaceAll('-', '').toLowerCase()}_${type}`;
}

export type SystemLogLanguageKeys = {
  systemLog: {};
};
