import { DefaultTimezone } from '../../../domain/valueObjects/defaultTimezone.vo';

describe('DefaultTimezone', () => {
  it('accepts an IANA timezone', () => {
    expect(new DefaultTimezone('Asia/Tehran').unpack()).toBe('Asia/Tehran');
  });

  it('rejects an invalid timezone', () => {
    expect(() => new DefaultTimezone('Tehran')).toThrow();
  });
});
