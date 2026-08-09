import { ValueObject } from 'src/dddLib/core';
import { ArgumentInvalidException } from 'src/dddLib/core/exceptions';

export class DefaultTimezone extends ValueObject<string> {
  private readonly _timezone: string;

  constructor(timezone: string) {
    super();
    this._timezone = typeof timezone === 'string' ? timezone.trim() : timezone;
    this.validate();
  }

  protected validate(): void {
    if (!this._timezone) {
      throw new ArgumentInvalidException('Tenant default timezone is required');
    }

    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: this._timezone,
      }).format();
    } catch {
      throw new ArgumentInvalidException(
        `Tenant default timezone=${this._timezone} is not a valid IANA timezone`,
      );
    }
  }

  public unpack(): string {
    return this._timezone;
  }
}
