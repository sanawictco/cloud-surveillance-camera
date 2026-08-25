import { assertMqttProductionSecurity } from '../bootChecks';

describe('assertMqttProductionSecurity', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('requires TLS MQTT and EMQX API URLs in production', () => {
    process.env.NODE_ENV = 'production';

    expect(() =>
      assertMqttProductionSecurity({
        brokerUrl: 'mqtt://broker.example.com',
        apiUrl: 'https://broker.example.com/api/v5',
        username: 'cloud',
        password: 'secret',
      }),
    ).toThrow('mqtts://');
    expect(() =>
      assertMqttProductionSecurity({
        brokerUrl: 'mqtts://broker.example.com',
        apiUrl: 'http://broker.example.com/api/v5',
        username: 'cloud',
        password: 'secret',
      }),
    ).toThrow('https://');
  });

  it('requires MQTT credentials in production', () => {
    process.env.NODE_ENV = 'production';

    expect(() =>
      assertMqttProductionSecurity({
        brokerUrl: 'mqtts://broker.example.com',
        apiUrl: 'https://broker.example.com/api/v5',
        username: '',
        password: '',
      }),
    ).toThrow('credentials are required');
  });
});
