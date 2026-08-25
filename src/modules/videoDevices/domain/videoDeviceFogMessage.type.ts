import { AggregateID } from 'src/dddLib/core';
import { EntityTypes } from '../shared/valueObjects/entityTypes';

interface VideoDeviceFogMessageMetadata {
  topic: string;
  retryCount: number;
  retryPeriodInSecond: number;
  entityId: AggregateID;
  entityType: EntityTypes;
  issuedAt?: number;
  expiresAt?: number;
}

export interface VideoDeviceFogConfigMessage {
  msgId: string;
  configType: string;
  data: object;
  nvrId: AggregateID;
  tenantId: AggregateID;
  metadata: VideoDeviceFogMessageMetadata;
}

export interface VideoDeviceFogCommandMessage {
  msgId: string;
  configType: string;
  data: string;
  nvrId: AggregateID;
  tenantId: AggregateID;
  metadata: VideoDeviceFogMessageMetadata;
}
