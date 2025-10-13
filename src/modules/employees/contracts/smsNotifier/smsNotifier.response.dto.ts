import { ResponseBase } from 'src/dddLib/contracts/response.base';
import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';

export class SmsNotifierResponseDto extends ResponseBase {
  phoneNumber: string;
  systemLogTypes: SystemLogTypes[];
  userId: string;
}
