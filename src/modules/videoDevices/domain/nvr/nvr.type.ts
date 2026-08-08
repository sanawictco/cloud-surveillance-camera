import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { SerialNumber } from '../../shared/valueObjects/serialNumber.vo';
import { AccessToken } from './valueObjects/accessToken.vo';
import { NvrPassword } from './valueObjects/nvrPassword.vo';
import { NvrLanguage } from './valueObjects/NvrLanguage.vo';
import {
  LiveSignalStatus,
  LiveSignalStatuses,
} from '../../shared/valueObjects/liveSignalStatus.vo';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';
import { CloudIsRecovering } from './valueObjects/cloudIsRecovering.vo';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';
import { BusinessId } from 'src/dddLib/core/businessId.vo';
import { IsActive } from '../../shared/valueObjects/isActive.vo';
import { MaxCameras } from './valueObjects/maxCameras.vo';

export interface NvrValueObjects {
  name: Name;
  workstationId: BusinessId;
  serialNumber: SerialNumber;
  accessToken: AccessToken;
  password: NvrPassword;
  maxCameras: MaxCameras;
  lang: NvrLanguage;
  isActive: IsActive;
  liveSignalStatus: LiveSignalStatus;
  cloudIsRecovering: CloudIsRecovering;
  runningConfigs: RunningConfigs;
}

export interface NvrProps {
  name: string;
  workstationId: string;
  serialNumber: string;
  accessToken: string;
  password: string;
  maxCameras: number;
  lang: LanguageCode;
  isActive: boolean;
  liveSignalStatus: LiveSignalStatuses;
  cloudIsRecovering: boolean;
  runningConfigs: Record<string, string>;
}

export interface CreateNvrProps {
  name: string;
  workstationId: string;
  serialNumber: string;
  accessToken: string;
  password: string;
  maxCameras: number;
}

export interface UpdateNvrProps {
  name?: string;
  password?: string;
  lang?: LanguageCode;
  liveSignalStatus?: LiveSignalStatuses;
  cloudIsRecovering?: boolean;
  runningConfigs?: Record<string, string>;
}

export class NvrCloudPubToFogMqttTopics {
  videoDeviceConfigs: string;
  cloudRecoveryDataAck: string; // this topic sufficient for cloud recovery
  cloudIsAvailable: string;
  pageConfig: string;

  constructor(props: NvrCloudPubToFogMqttTopics) {
    this.videoDeviceConfigs = props.videoDeviceConfigs;
    this.cloudRecoveryDataAck = props.cloudRecoveryDataAck;
    this.cloudIsAvailable = props.cloudIsAvailable;
    this.pageConfig = props.pageConfig;
  }
}

export const NvrCloudSubOnFogMqttTopics = {
  videoDeviceConfigs: `+/videoDevice/Config/sub`,
  cameraCommands: `+/camera/data/sub`,
  videoDevicesSystemLogs: `+/videoDevices/systemLogs/sub`,
  pageConfigs: `+/page/config/sub`,
};

export enum NvrConfigs {
  UPDATE_NVR = 'updateNvr',
  DELETE_NVR = 'deleteNvr',
  ACTIVE_NVR = 'activeNvr',
  IN_ACTIVE_NVR = 'inactiveNvr',
  REGISTER = 'register',
  FOG_LIVE_SIGNAL = 'fogLiveSignal',
  CLOUD_IS_RECOVERING = 'cloudIsRecovering',
  SEARCH = 'search',
  SOFT_DELETE_MULTI_CAMERAS = 'softDeleteMultiCameras',
}

export enum NvrWebSocketDataTypes {
  CLOUD_IS_RECOVERING = 'cloudIsRecovering',
  LIVE_SIGNAL = 'liveSignal',
}

export enum NvrWebSocketConfigTypes {
  UPDATE_NVR = 'updateNvr',
  CREATE_NVR = 'createNvr',
  DELETE_NVR = 'deleteNvr',
  ACTIVE_NVR = 'activeNvr',
  IN_ACTIVE_NVR = 'inactiveNvr',
  SEARCH = 'search',
  REGISTER = 'register',
}

export enum NvrSystemLogDataTypes {
  LIVE_SIGNAL = 'liveSignal',
  CLOUD_RECOVERY = 'cloudRecovery',
}

export enum NvrSystemLogConfigTypes {
  ACTIVE_NVR = 'activeNvr',
  IN_ACTIVE_NVR = 'inactiveNvr',
  UPDATE_NVR = 'updateNvr',
}

export enum NvrSystemLogConfigTypesFromFog {
  UPDATE_HARDWARE_CONFIG = 'updateHardwareConfig',
  REGISTER = 'register',
}

export type NvrLanguageKeys = {
  nvr: {
    actorLog: {
      created: string;
      deleted: string;
      active: string;
      inactive: string;
      nameUpdated: string;
      passwordUpdated: string;
      langUpdated: {
        toFa: string;
        toEn: string;
        toAr: string;
        toKu: string;
      };
    };
    systemLog: {
      updateFailed: string;
      activationFailed: string;
      inactivationFailed: string;
      liveSignalFailed: string;
      recoverySucceeded: string;
    };
    response: {
      socket: {
        created: string;
        updated: string;
        deleted: string;
        activated: string;
        inactivated: string;
        startAutoRegisterProccessing: string;
        allConnectedCamerasAreUpToDate: string;
      };
    };
    errorResponse: {
      badRequest: {
        isNotActive: string;
        nameIsDuplicated: string;
        liveSignalFailed: string;
        hasAlreadyActivated: string;
        hasAlreadyInactivated: string;
        duplicatedNvr: string;
        camerasExceedsNvrCapacity: string;
      };
    };
  };
};
