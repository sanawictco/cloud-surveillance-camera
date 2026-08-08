import { ResponseBase } from 'src/dddLib/contracts/response.base';
import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';

export class SmsNotifierResponseDto extends ResponseBase {
  constructor(
    props: ConstructorParameters<typeof ResponseBase>[0],
    public phoneNumber: string,
    public systemLogTypes: SystemLogTypes[],
    public userId: string,
  ) {
    super(props);
  }
}
