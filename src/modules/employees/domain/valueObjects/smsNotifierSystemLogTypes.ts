import { ValueObject } from 'src/dddLib/core';
import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';

type SystemLogType = SystemLogTypes[] | undefined;
export class SmsNotifierSystemLogTypes extends ValueObject<SystemLogType> {
  private _smsNotifierSystemLogTypes: SystemLogType;
  constructor(systemLogType: SystemLogType) {
    super();
    this._smsNotifierSystemLogTypes = systemLogType;
    this.validate();
  }
  protected validate(): void {}
  public unpack(): SystemLogType {
    return this._smsNotifierSystemLogTypes;
  }
}
