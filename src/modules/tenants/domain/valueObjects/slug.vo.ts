import { ValueObject } from 'src/dddLib/core';
import { ArgumentInvalidException } from 'src/dddLib/core/exceptions';

export class Slug extends ValueObject<string> {
  private readonly _slug: string;

  constructor(slug: string) {
    super();
    this._slug = typeof slug === 'string' ? slug.trim().toLowerCase() : slug;
    this.validate();
  }

  protected validate(): void {
    if (
      typeof this._slug !== 'string' ||
      this._slug.length < 3 ||
      this._slug.length > 63 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(this._slug)
    ) {
      throw new ArgumentInvalidException(
        'Tenant slug must be 3-63 lowercase letters, numbers, or single hyphens',
      );
    }
  }

  public unpack(): string {
    return this._slug;
  }
}
