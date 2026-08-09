import { IsNotEmpty, IsString } from 'class-validator';
import { validateMqttPayload } from './validateMqttPayload';

class TestPayload {
  @IsString()
  @IsNotEmpty()
  msgId!: string;
}

describe('validateMqttPayload', () => {
  it('returns a validated class instance and removes unknown fields', () => {
    const payload = validateMqttPayload(TestPayload, {
      msgId: 'msg-1',
      unexpected: true,
    });

    expect(payload).toBeInstanceOf(TestPayload);
    expect(payload).toEqual({ msgId: 'msg-1' });
  });

  it('rejects invalid payloads', () => {
    expect(() => validateMqttPayload(TestPayload, { msgId: '' })).toThrow(
      'Invalid MQTT payload for TestPayload',
    );
  });
});
