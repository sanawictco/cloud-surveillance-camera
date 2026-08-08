import { ResponseBase } from 'src/dddLib/contracts/response.base';
import {
  SystemLogNotifyStatus,
  SystemLogSections,
  SystemLogTypes,
} from '../../domain/systemLog.type';

export class SystemLogResponseDto extends ResponseBase {
  constructor(
    props: ConstructorParameters<typeof ResponseBase>[0],
    public type: SystemLogTypes,
    public message: string,
    public section: SystemLogSections,
    public details: object,
    public systemLogNofityReport: SystemLogNotifyStatus[],
  ) {
    super(props);
  }
}
