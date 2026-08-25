import { Password } from '../../../domain/camera/valueObjects/password.vo';
import { Username } from '../../../domain/camera/valueObjects/username.vo';
import { AccessToken } from '../../../domain/nvr/valueObjects/accessToken.vo';
import { NvrPassword } from '../../../domain/nvr/valueObjects/nvrPassword.vo';

describe('Device credential value objects', () => {
  it.each([
    ['NVR password', () => new NvrPassword('secret')],
    ['NVR access token', () => new AccessToken('secret-token')],
    ['camera password', () => new Password('secret')],
    ['camera username', () => new Username('x')],
  ])('does not include the rejected %s value in errors', (_name, create) => {
    expect(create).toThrow();
    try {
      create();
    } catch (error) {
      expect((error as Error).message).not.toMatch(/secret|secret-token|=x/);
    }
  });
});
