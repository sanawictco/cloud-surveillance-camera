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
import { ProductModel } from '../camera/valueObjects/productModel.vo';

export interface NvrValueObjects {
  name: Name;
  readonly tenantId: BusinessId;
  readonly serialNumber: SerialNumber;
  readonly accessToken: AccessToken;
  readonly maxCameras: MaxCameras;
  readonly productModel: ProductModel;
  password: NvrPassword;
  lang: NvrLanguage;
  isActive: IsActive;
  liveSignalStatus: LiveSignalStatus;
  cloudIsRecovering: CloudIsRecovering;
  runningConfigs: RunningConfigs;
}

export interface NvrProps {
  name: string;
  readonly tenantId: string;
  readonly serialNumber: string;
  readonly accessToken: string;
  readonly maxCameras: number;
  readonly productModel: string;
  password: string;
  lang: LanguageCode;
  isActive: boolean;
  liveSignalStatus: LiveSignalStatuses;
  cloudIsRecovering: boolean;
  runningConfigs: Record<string, string>;
}

export interface CreateNvrProps {
  name: string;
  readonly tenantId: string;
  readonly productModel: string;
  readonly serialNumber: string;
  readonly accessToken: string;
  readonly maxCameras: number;
  password: string;
}

export interface UpdateNvrProps {
  name?: string;
  password?: string;
  lang?: LanguageCode;
  liveSignalStatus?: LiveSignalStatuses;
  cloudIsRecovering?: boolean;
  runningConfigs?: Record<string, string>;
}

export interface NvrCloudPubToFogMqttTopics {
  videoDeviceConfigs: string;
  cloudRecoveryDataAck: string;
  cloudIsAvailable: string;
  pageConfig: string;
  cameraData: string;
}

/**
 * Fog->cloud response topics the shared cloud MQTT client subscribes to.
 * The `+` wildcards are tenantId and nvrId; handlers must parse the concrete
 * topic and validate ownership (see `deviceMqttTopics.ts` parsers).
 */
export const NvrCloudSubOnFogMqttTopics = {
  videoDeviceConfigs: `tenants/+/nvrs/+/config/to-cloud`,
  pageConfigs: `tenants/+/nvrs/+/pages/to-cloud`,
};

export enum NvrConfigs {
  UPDATE = 'update',
  DELETE = 'delete',
  ACTIVE = 'active',
  IN_ACTIVE = 'inactive',
  SEARCH = 'search',
  REGISTER = 'register',
  FOG_LIVE_SIGNAL = 'fogLiveSignal',
  CLOUD_IS_RECOVERING = 'cloudIsRecovering',
  SOFT_DELETE_MULTI_CAMERAS = 'softDeleteMultiCameras',
  ACTIVE_MULTI_CAMERAS = 'activeMultiCameras',
  IN_ACTIVE_MULTI_CAMERAS = 'inActiveMultiCameras',
}

export const NVR_FOG_FETCHABLE_CONFIGS = [
  NvrConfigs.UPDATE,
  NvrConfigs.DELETE,
  NvrConfigs.ACTIVE,
  NvrConfigs.IN_ACTIVE,
  NvrConfigs.FOG_LIVE_SIGNAL,
  NvrConfigs.CLOUD_IS_RECOVERING,
  NvrConfigs.SEARCH,
  NvrConfigs.REGISTER,
] as const;

export enum NvrWebSocketDataTypes {
  CLOUD_IS_RECOVERING = 'cloudIsRecovering',
  LIVE_SIGNAL = 'liveSignal',
}

export enum NvrWebSocketConfigTypes {
  UPDATE = 'update',
  CREATE = 'create',
  DELETE = 'delete',
  ACTIVE = 'active',
  IN_ACTIVE = 'inactive',
  SEARCH = 'search',
  REGISTER = 'register',
}

export enum NvrSystemLogDataTypes {
  LIVE_SIGNAL = 'liveSignal',
  CLOUD_RECOVERY = 'cloudRecovery',
}

export enum NvrSystemLogConfigTypes {
  ACTIVE = 'active',
  IN_ACTIVE = 'inactive',
  UPDATE = 'update',
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
        multiCameraInactivated: string;
        multiCameraActivated: string;
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
