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

const NVR_SERIAL = 'NVR00001';
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const NVR_A = '33333333-3333-4333-8333-333333333333';

function buildTopics() {
  return {
    pubs: {
      videoDeviceConfigs: `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-fog`,
    },
    subs: {
      videoDeviceConfigs: `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-cloud`,
    },
  };
}

function buildService() {
  return new MqttApiService({
    logger: { error: jest.fn(), debug: jest.fn(), log: jest.fn() },
  } as never);
}

describe('MqttApiService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('provisions the EMQX user and exact allow rules for the NVR topics', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: {} });
    const service = buildService();

    await service.createNvrTopics(NVR_SERIAL, 'token', buildTopics());

    expect(axios.post).toHaveBeenNthCalledWith(
      1,
      'https://emqx.example.com/api/v5/authentication/password_based:built_in_database/users',
      { password: 'token', user_id: NVR_SERIAL },
      expect.anything(),
    );
    // one publish rule for every cloud->fog topic, one subscribe rule for
    // every fog->cloud topic, all exact
    const rules = (axios.post as jest.Mock).mock.calls[1]![1][0].rules;
    expect(rules).toEqual([
      {
        action: 'publish',
        permission: 'allow',
        topic: `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-cloud`,
      },
      {
        action: 'subscribe',
        permission: 'allow',
        topic: `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-fog`,
      },
    ]);
  });

  it('rolls back the orphaned EMQX user when the ACL rules cannot be created', async () => {
    (axios.post as jest.Mock)
      .mockResolvedValueOnce({ data: {} }) // user created
      .mockRejectedValueOnce(new Error('acl rejected')); // rules failed
    const service = buildService();

    await expect(
      service.createNvrTopics(NVR_SERIAL, 'token', buildTopics()),
    ).rejects.toThrow('acl rejected');

    expect(axios.delete).toHaveBeenCalledWith(
      'https://emqx.example.com/api/v5/authentication/password_based:built_in_database/users/NVR00001',
      expect.anything(),
    );
  });

  it('deletes the whole EMQX user and rule set for the NVR', async () => {
    (axios.delete as jest.Mock).mockResolvedValue({ data: {} });
    (axios.get as jest.Mock).mockResolvedValue({ data: [] });
    (axios.put as jest.Mock).mockResolvedValue({ data: {} });
    const service = buildService();

    await service.deleteNvrTopics(NVR_SERIAL, NVR_A);

    expect(axios.delete).toHaveBeenCalledTimes(2);
  });
});
