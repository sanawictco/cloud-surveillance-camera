import {
  cameraDataPubTopic,
  cloudIsAvailablePubTopic,
  cloudRecoveryDataAckPubTopic,
  pageConfigPubTopic,
  parseNvrConfigResponseTopic,
  parsePageConfigResponseTopic,
  videoDeviceConfigPubTopic,
} from '../../shared/deviceMqttTopics';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const NVR_A = '33333333-3333-4333-8333-333333333333';
const CAMERA_A = '55555555-5555-4555-8555-555555555555';

describe('device MQTT topic builders', () => {
  it('builds cloud->fog topics inside the tenant/NVR hierarchy', () => {
    expect(videoDeviceConfigPubTopic(TENANT_A, NVR_A)).toBe(
      `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-fog`,
    );
    expect(pageConfigPubTopic(TENANT_A, NVR_A)).toBe(
      `tenants/${TENANT_A}/nvrs/${NVR_A}/pages/to-fog`,
    );
    expect(cloudIsAvailablePubTopic(TENANT_A, NVR_A)).toBe(
      `tenants/${TENANT_A}/nvrs/${NVR_A}/cloud-status/to-fog`,
    );
    expect(cloudRecoveryDataAckPubTopic(TENANT_A, NVR_A)).toBe(
      `tenants/${TENANT_A}/nvrs/${NVR_A}/cloud-recovery/to-fog`,
    );
  });

  it('addresses camera commands to the NVR-level camera topic', () => {
    expect(cameraDataPubTopic(TENANT_A, NVR_A)).toBe(
      `tenants/${TENANT_A}/nvrs/${NVR_A}/cameras/to-fog`,
    );
  });
});

describe('parseNvrConfigResponseTopic', () => {
  it('parses a response topic into tenant and NVR', () => {
    expect(
      parseNvrConfigResponseTopic(
        `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-cloud`,
      ),
    ).toEqual({ tenantId: TENANT_A, nvrId: NVR_A });
  });

  it.each([
    [
      'the cloud->fog direction reversed',
      `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-fog`,
    ],
    [
      'a page topic offered to the config parser',
      `tenants/${TENANT_A}/nvrs/${NVR_A}/pages/to-cloud`,
    ],
    [
      'a different resource segment',
      `tenants/${TENANT_A}/nvrs/${NVR_A}/other/to-cloud`,
    ],
    ['a missing hierarchy root', `${TENANT_A}/nvrs/${NVR_A}/config/to-cloud`],
    [
      'an extra segment',
      `tenants/${TENANT_A}/nvrs/${NVR_A}/cameras/${CAMERA_A}/config/to-cloud`,
    ],
    ['a wildcard tenant', `tenants/+/nvrs/${NVR_A}/config/to-cloud`],
    [
      'a traversal injected into the tenant',
      `tenants/${TENANT_A}/../nvrs/${NVR_A}/config/to-cloud`,
    ],
    ['a non-UUID tenant', `tenants/not-a-tenant/nvrs/${NVR_A}/config/to-cloud`],
    ['a non-UUID NVR', `tenants/${TENANT_A}/nvrs/not-an-nvr/config/to-cloud`],
    [
      'an embedded-UUID tenant',
      `tenants/x${TENANT_A}x/nvrs/${NVR_A}/config/to-cloud`,
    ],
    ['an empty topic', ''],
  ])('rejects a response topic with %s', (_name, topic) => {
    expect(() => parseNvrConfigResponseTopic(topic)).toThrow(
      /invalid device response topic/,
    );
  });
});

describe('parsePageConfigResponseTopic', () => {
  it('parses a response topic into tenant and NVR', () => {
    expect(
      parsePageConfigResponseTopic(
        `tenants/${TENANT_A}/nvrs/${NVR_A}/pages/to-cloud`,
      ),
    ).toEqual({ tenantId: TENANT_A, nvrId: NVR_A });
  });

  it('rejects a config response topic offered to the page parser', () => {
    expect(() =>
      parsePageConfigResponseTopic(
        `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-cloud`,
      ),
    ).toThrow(/invalid device response topic/);
  });

  it('rejects a topic with a non-UUID identity', () => {
    expect(() =>
      parsePageConfigResponseTopic(`tenants/${TENANT_A}/nvrs/+/pages/to-cloud`),
    ).toThrow(/invalid device response topic/);
  });
});
