import { ValueObject } from 'src/dddLib/core';
const INIT_VALUE = false;
export class IsEmployeeDeleted extends ValueObject<boolean> {
  private _isEmployeeDeleted: boolean;
  constructor(isEmployeeDeleted: boolean) {
    super();
    this._isEmployeeDeleted = isEmployeeDeleted;
    this.validate();
  }
  get isEmployeeDeleted() {
    return this._isEmployeeDeleted;
  }
  protected validate(): void {}

  public unpack(): boolean {
    return this._isEmployeeDeleted;
  }

  static init(): IsEmployeeDeleted {
    return new IsEmployeeDeleted(INIT_VALUE);
  }
}
