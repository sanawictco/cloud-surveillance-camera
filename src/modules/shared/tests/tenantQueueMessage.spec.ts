import {
  assertTenantQueueMessage,
  describeTenantQueueFailure,
  TenantQueueMessageError,
} from '../tenantQueueMessage';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const NVR_A = '33333333-3333-4333-8333-333333333333';
const NVR_B = '44444444-4444-4444-8444-444444444444';

const NOW = 1_000_000;

function buildMessage(overrides: Record<string, any> = {}) {
  const metadata = {
    topic: `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-fog`,
    entityId: NVR_A,
    entityType: EntityTypes.NVR,
    retryCount: 3,
    retryPeriodInSecond: 10,
    issuedAt: NOW - 1_000,
    expiresAt: NOW + 10_000,
    ...(overrides.metadata ?? {}),
  };
  return {
    msgId: '4294967295',
    configType: 'update',
    tenantId: TENANT_A,
    nvrId: NVR_A,
    ...overrides,
    metadata,
  };
}

function assertConfig(message: unknown, jobId?: string) {
  return assertTenantQueueMessage(message, {
    allowedEntityTypes: [EntityTypes.NVR, EntityTypes.CAMERA],
    expectedTopic: ({ tenantId, nvrId }) =>
      `tenants/${tenantId}/nvrs/${nvrId}/config/to-fog`,
    jobId,
    now: NOW,
  });
}

describe('assertTenantQueueMessage', () => {
  it('returns the validated scope for a well formed message', () => {
    const scope = assertConfig(
      buildMessage(),
      `t-${TENANT_A}-n-${NVR_A}-m-4294967295`,
    );

    expect(scope).toEqual({
      tenantId: TENANT_A,
      nvrId: NVR_A,
      msgId: '4294967295',
      configType: 'update',
      entityId: NVR_A,
      entityType: EntityTypes.NVR,
      topic: `tenants/${TENANT_A}/nvrs/${NVR_A}/config/to-fog`,
      jobId: `t-${TENANT_A}-n-${NVR_A}-m-4294967295`,
    });
  });

  it('rejects a message whose tenant is missing', () => {
    expect(() => assertConfig(buildMessage({ tenantId: undefined }))).toThrow(
      TenantQueueMessageError,
    );
  });

  it('rejects a tenant that is not a UUID', () => {
    expect(() => assertConfig(buildMessage({ tenantId: 'tenant-a' }))).toThrow(
      /tenant is invalid/,
    );
  });

  it('rejects a tenant with a UUID embedded in a longer string', () => {
    // an unanchored UUID check would accept this and then use the whole value
    // as a Redis key segment
    expect(() =>
      assertConfig(buildMessage({ tenantId: `x${TENANT_A}x` })),
    ).toThrow(/tenant is invalid/);
  });

  it('rejects a message whose NVR is missing', () => {
    expect(() => assertConfig(buildMessage({ nvrId: undefined }))).toThrow(
      /NVR is invalid/,
    );
  });

  it('rejects a msgId outside the unsigned 32-bit range', () => {
    expect(() => assertConfig(buildMessage({ msgId: '4294967296' }))).toThrow(
      /message ID is invalid/,
    );
  });

  it('rejects the reserved zero msgId', () => {
    expect(() => assertConfig(buildMessage({ msgId: '0' }))).toThrow(
      /message ID is invalid/,
    );
  });

  it('rejects an entity type this queue does not serve', () => {
    expect(() =>
      assertConfig(
        buildMessage({ metadata: { entityType: EntityTypes.PAGE } }),
      ),
    ).toThrow(/entity is invalid/);
  });

  it('rejects an entityId that could inject MQTT topic separators', () => {
    // entityId must be a whole UUID wherever identity is threaded through
    // topics or Redis keys; a value like `aaa/#` carries separators
    const evilId = 'aaa/#';
    expect(() =>
      assertTenantQueueMessage(
        buildMessage({
          metadata: {
            entityId: evilId,
            entityType: EntityTypes.CAMERA,
            topic: `tenants/${TENANT_A}/nvrs/${NVR_A}/cameras/to-fog`,
          },
        }),
        {
          allowedEntityTypes: [EntityTypes.CAMERA],
          expectedTopic: ({ nvrId, entityId }) =>
            `tenants/${TENANT_A}/nvrs/${nvrId}/cameras/to-fog`,
          now: NOW,
        },
      ),
    ).toThrow(/entity is invalid/);
  });

  it('rejects a non-UUID entityId', () => {
    expect(() =>
      assertConfig(buildMessage({ metadata: { entityId: 'nvr-id' } })),
    ).toThrow(/entity is invalid/);
  });

  it('rejects a topic that does not match the message tenant', () => {
    expect(() =>
      assertConfig(
        buildMessage({
          metadata: {
            topic: `tenants/${TENANT_B}/nvrs/${NVR_A}/config/to-fog`,
          },
        }),
      ),
    ).toThrow(/topic is invalid/);
  });

  it('rejects a topic that does not match the message NVR', () => {
    expect(() =>
      assertConfig(
        buildMessage({
          metadata: {
            topic: `tenants/${TENANT_A}/nvrs/${NVR_B}/config/to-fog`,
          },
        }),
      ),
    ).toThrow(/topic is invalid/);
  });

  it('rejects a message with no lifetime stamped', () => {
    expect(() =>
      assertConfig(
        buildMessage({
          metadata: { issuedAt: undefined, expiresAt: undefined },
        }),
      ),
    ).toThrow(/lifetime is invalid/);
  });

  it('rejects a message issued in the future', () => {
    expect(() =>
      assertConfig(buildMessage({ metadata: { issuedAt: NOW + 5_000 } })),
    ).toThrow(/lifetime is invalid/);
  });

  it('rejects a message that expires before it was issued', () => {
    expect(() =>
      assertConfig(
        buildMessage({ metadata: { issuedAt: NOW - 10, expiresAt: NOW - 20 } }),
      ),
    ).toThrow(/lifetime is invalid/);
  });

  it('rejects an expired message', () => {
    expect(() =>
      assertConfig(buildMessage({ metadata: { expiresAt: NOW - 1 } })),
    ).toThrow(/has expired/);
  });

  it('accepts an expired message when the caller opts in', () => {
    // expiry handlers run after the final retry, so the window is closed by
    // definition there
    const scope = assertTenantQueueMessage(
      buildMessage({ metadata: { expiresAt: NOW - 1 } }),
      {
        allowedEntityTypes: [EntityTypes.NVR],
        expectedTopic: ({ tenantId, nvrId }) =>
          `tenants/${tenantId}/nvrs/${nvrId}/config/to-fog`,
        now: NOW,
        allowExpired: true,
      },
    );

    expect(scope.tenantId).toBe(TENANT_A);
  });

  it('still rejects a missing lifetime even when expiry is allowed', () => {
    // allowExpired must relax only the expiry comparison, never the structural
    // check that a lifetime was stamped at all
    expect(() =>
      assertTenantQueueMessage(
        buildMessage({
          metadata: { issuedAt: undefined, expiresAt: undefined },
        }),
        {
          allowedEntityTypes: [EntityTypes.NVR],
          expectedTopic: ({ tenantId, nvrId }) =>
            `tenants/${tenantId}/nvrs/${nvrId}/config/to-fog`,
          now: NOW,
          allowExpired: true,
        },
      ),
    ).toThrow(/lifetime is invalid/);
  });

  it('still rejects a foreign queue key when expiry is allowed', () => {
    expect(() =>
      assertTenantQueueMessage(buildMessage(), {
        allowedEntityTypes: [EntityTypes.NVR],
        expectedTopic: ({ tenantId, nvrId }) =>
          `tenants/${tenantId}/nvrs/${nvrId}/config/to-fog`,
        jobId: `t-${TENANT_B}-n-${NVR_A}-m-4294967295`,
        now: NOW,
        allowExpired: true,
      }),
    ).toThrow(/scope is invalid/);
  });

  it('rejects a message stored under another tenant queue key', () => {
    expect(() =>
      assertConfig(buildMessage(), `t-${TENANT_B}-n-${NVR_A}-m-4294967295`),
    ).toThrow(/scope is invalid/);
  });

  it('rejects a message stored under another NVR queue key', () => {
    expect(() =>
      assertConfig(buildMessage(), `t-${TENANT_A}-n-${NVR_B}-m-4294967295`),
    ).toThrow(/scope is invalid/);
  });

  it('rejects a message stored under a different msgId queue key', () => {
    expect(() =>
      assertConfig(buildMessage(), `t-${TENANT_A}-n-${NVR_A}-m-7`),
    ).toThrow(/scope is invalid/);
  });

  it('derives the same uint32 msgId under different NVR scopes without collision', () => {
    const forNvrA = assertConfig(buildMessage());
    const forNvrB = assertConfig(
      buildMessage({
        nvrId: NVR_B,
        metadata: {
          entityId: NVR_B,
          topic: `tenants/${TENANT_A}/nvrs/${NVR_B}/config/to-fog`,
        },
      }),
    );

    expect(forNvrA.msgId).toBe(forNvrB.msgId);
    expect(forNvrA.jobId).not.toBe(forNvrB.jobId);
  });

  it('rejects a non-object message', () => {
    expect(() => assertConfig('not-a-message')).toThrow(/structure is invalid/);
  });
});

describe('describeTenantQueueFailure', () => {
  it('reports tenant identity without echoing the payload', () => {
    const message = buildMessage({
      data: { password: 'super-secret', username: 'admin' },
    });

    const described = describeTenantQueueFailure(message, 3);

    expect(described).toContain(`tenantId=${TENANT_A}`);
    expect(described).toContain(`nvrId=${NVR_A}`);
    expect(described).toContain('msgId=4294967295');
    expect(described).toContain('operation=update');
    expect(described).toContain('attempts=3');
    expect(described).not.toContain('super-secret');
    expect(described).not.toContain('admin');
  });

  it('describes an unparsable message without throwing', () => {
    expect(describeTenantQueueFailure(undefined)).toContain('tenantId=unknown');
  });
});
