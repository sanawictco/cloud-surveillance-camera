import {
  BaseResponseProps,
  ResponseBase,
} from 'src/dddLib/contracts/response.base';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

interface NvrResponseProps extends BaseResponseProps {
  name: string;
  workstationId: string;
  serialNumber: string;
  accessToken: string;
  password: string;
  lang: LanguageCode;
  isActive: boolean;
  liveSignalStatus: LiveSignalStatuses;
  cloudIsRecovering: boolean;
}

export class NvrResponseDto extends ResponseBase {
  name: string;
  workstationId: string;
  serialNumber: string;
  accessToken: string;
  password: string;
  lang: LanguageCode;
  isActive: boolean;
  liveSignalStatus: LiveSignalStatuses;
  cloudIsRecovering: boolean;

  constructor(props: NvrResponseProps) {
    super(props);
    this.name = props.name;
    this.workstationId = props.workstationId;
    this.serialNumber = props.serialNumber;
    this.accessToken = props.accessToken;
    this.password = props.password;
    this.lang = props.lang;
    this.isActive = props.isActive;
    this.liveSignalStatus = props.liveSignalStatus;
    this.cloudIsRecovering = props.cloudIsRecovering;
  }
}
