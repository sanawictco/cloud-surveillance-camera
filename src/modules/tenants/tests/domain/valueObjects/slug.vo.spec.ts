import { Slug } from '../../../domain/valueObjects/slug.vo';

describe('Slug', () => {
  it('normalizes a tenant slug', () => {
    expect(new Slug('  Sanaw-Cloud  ').unpack()).toBe('sanaw-cloud');
  });

  it('rejects a malformed tenant slug', () => {
    expect(() => new Slug('sanaw_cloud')).toThrow();
  });
});
