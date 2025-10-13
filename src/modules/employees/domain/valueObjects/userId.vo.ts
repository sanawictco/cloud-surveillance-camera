import { ValueObject } from 'src/dddLib/core';
import { ArgumentOutOfRangeException } from 'src/dddLib/core/exceptions';
import { Guard } from 'src/dddLib/utils/guard';

export class UserId extends ValueObject<string> {
  private _userId: string;
  constructor(at: string) {
    super();
    this._userId = at;
    this.validate();
  }
  protected validate(): void {
    if (!Guard.isUUIDv4(this._userId))
      throw new ArgumentOutOfRangeException(
        `ValueObjectError: userId=${this._userId} is not in uuid format`,
      );
  }
  public unpack(): string {
    return this._userId;
  }
}
