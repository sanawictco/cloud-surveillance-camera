jest.mock('axios');
jest.mock('configs/app.config', () => ({
  __esModule: true,
  default: () => ({
    mqtt: {
      api: {
        apiUrl: 'https://emqx.example.com/api/v5',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
      },
    },
  }),
}));

import axios from 'axios';
import { MqttApiService } from './mqttApi.service';

describe('MqttApiService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('aborts an ACL mutation when its distributed lock is unavailable', async () => {
    jest.useFakeTimers();
    const acquireLock = jest.fn().mockResolvedValue(null);
    const service = new MqttApiService(
      { acquireLock, releaseLock: jest.fn() } as never,
      { logger: { error: jest.fn() } } as never,
    );

    const result = service.createCameraTopics('NVR00001', {
      pubs: {},
      subs: {},
    });
    const settled = result.catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(5_100);

    await expect(settled).resolves.toEqual(
      expect.objectContaining({
        message: 'MQTT ACL lock for NVR NVR00001 was not acquired',
      }),
    );
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.put).not.toHaveBeenCalled();
  });
});
