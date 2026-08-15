import { AggregateID } from 'src/dddLib/core';
import { VideoDeviceEntityTypes } from '../shared/valueObjects/videoDeviceEntityTypes';

interface VideoDeviceFogMessageMetadata {
  topic: string;
  retryCount: number;
  retryPeriodInSecond: number;
  entityId: AggregateID;
  entityType: VideoDeviceEntityTypes;
  issuedAt?: number;
}

export interface VideoDeviceFogConfigMessage {
  msgId: string;
  configType: string;
  data: object;
  nvrId: AggregateID;
  metadata: VideoDeviceFogMessageMetadata;
}

export interface VideoDeviceFogCommandMessage {
  msgId: string;
  configType: string;
  data: string;
  metadata: VideoDeviceFogMessageMetadata;
}
