import { NvrConfigs } from '../../../domain/nvr/nvr.type';
import { NvrRepository } from '../../../infra/nvr/nvr.repository';

type StoredNvr = {
  id: string;
  tenantId: string;
  runningConfigs: Record<string, string>;
  updatedAt?: Date;
};

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

describe('NvrRepository', () => {
  function buildRepository(initial: StoredNvr[]) {
    const records = new Map(initial.map((record) => [record.id, record]));
    const model = {
      findOneAndUpdate: jest.fn(
        (filter: Record<string, unknown>, update: Record<string, object>) => {
          const record = [...records.values()].find((candidate) =>
            matches(candidate, filter),
          );
          let result: StoredNvr | null = null;
          if (record) {
            applyUpdate(record, update);
            result = structuredClone(record);
          }
          return { lean: jest.fn().mockResolvedValue(result) };
        },
      ),
    };
    const cache = { delete: jest.fn().mockResolvedValue(undefined) };
    const repository = new NvrRepository(
      model as never,
      {} as never,
      cache as never,
      {} as never,
    );
    return { repository, records };
  }

  it('preserves provisioning claims while resetting transient configs on restart', async () => {
    const record = {
      id: 'nvr-1',
      runningConfigs: {
        init: '-1',
        search: 'search-msg',
        update: 'update-msg',
      },
    };
    const updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const model = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([record]),
      }),
      updateOne,
    };
    const cache = { set: jest.fn().mockResolvedValue(undefined) };
    const repository = new NvrRepository(
      model as never,
      {} as never,
      cache as never,
      {} as never,
    );

    await repository.restoreAndInitRecordsToCache();

    expect(updateOne).toHaveBeenCalledWith(
      { id: record.id },
      {
        $set: {
          runningConfigs: { init: '-1', search: 'search-msg' },
        },
      },
    );
    expect(cache.set).toHaveBeenCalledWith('NvrModel:nvr-1', {
      ...record,
      runningConfigs: { init: '-1', search: 'search-msg' },
    });
  });

  it('admits exactly one provisioning operation for the same NVR', async () => {
    const { repository, records } = buildRepository([
      { id: 'nvr-1', tenantId: TENANT_A, runningConfigs: { init: '-1' } },
    ]);

    const results = await Promise.all([
      repository.claimProvisioningConfig(
        'nvr-1',
        NvrConfigs.SEARCH,
        'search-msg',
        TENANT_A,
      ),
      repository.claimProvisioningConfig(
        'nvr-1',
        NvrConfigs.REGISTER,
        'register-msg',
        TENANT_A,
      ),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(
      records.get('nvr-1')!.runningConfigs[NvrConfigs.SEARCH] ??
        records.get('nvr-1')!.runningConfigs[NvrConfigs.REGISTER],
    ).toMatch(/^(search|register)-msg$/);
  });

  it('admits provisioning operations for different NVRs independently', async () => {
    const { repository, records } = buildRepository([
      { id: 'nvr-1', tenantId: TENANT_A, runningConfigs: { init: '-1' } },
      { id: 'nvr-2', tenantId: TENANT_A, runningConfigs: { init: '-1' } },
    ]);

    const results = await Promise.all([
      repository.claimProvisioningConfig(
        'nvr-1',
        NvrConfigs.SEARCH,
        'search-msg',
        TENANT_A,
      ),
      repository.claimProvisioningConfig(
        'nvr-2',
        NvrConfigs.REGISTER,
        'register-msg',
        TENANT_A,
      ),
    ]);

    expect(results).toEqual([true, true]);
    expect(records.get('nvr-1')!.runningConfigs.search).toBe('search-msg');
    expect(records.get('nvr-2')!.runningConfigs.register).toBe('register-msg');
  });

  it('conditionally unlocks only the matching operation', async () => {
    const { repository, records } = buildRepository([
      {
        id: 'nvr-1',
        tenantId: TENANT_A,
        runningConfigs: { init: '-1', search: 'search-msg' },
      },
    ]);

    const stale = await repository.unsetRunningConfigIfMatches(
      'nvr-1',
      NvrConfigs.SEARCH,
      'stale-msg',
      TENANT_A,
    );
    const current = await repository.unsetRunningConfigIfMatches(
      'nvr-1',
      NvrConfigs.SEARCH,
      'search-msg',
      TENANT_A,
    );

    expect(stale).toBe(false);
    expect(current).toBe(true);
    expect(records.get('nvr-1')!.runningConfigs.search).toBeUndefined();
  });

  it('never mutates a running config belonging to another tenant', async () => {
    const { repository, records } = buildRepository([
      {
        id: 'nvr-1',
        tenantId: TENANT_A,
        runningConfigs: { init: '-1', search: 'search-msg' },
      },
    ]);

    await expect(
      repository.claimProvisioningConfig(
        'nvr-1',
        NvrConfigs.REGISTER,
        'attacker-msg',
        TENANT_B,
      ),
    ).resolves.toBe(false);
    await expect(
      repository.unsetRunningConfigIfMatches(
        'nvr-1',
        NvrConfigs.SEARCH,
        'search-msg',
        TENANT_B,
      ),
    ).resolves.toBe(false);
    await expect(
      repository.setRunningConfig(
        'nvr-1',
        NvrConfigs.SEARCH,
        'attacker-msg',
        TENANT_B,
      ),
    ).resolves.toBe(false);
    await expect(
      repository.resetRunningConfigs('nvr-1', TENANT_B),
    ).resolves.toBe(false);

    expect(records.get('nvr-1')!.runningConfigs).toEqual({
      init: '-1',
      search: 'search-msg',
    });
  });
});

function matches(record: StoredNvr, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$and') {
      return (expected as Record<string, unknown>[]).every((clause) =>
        matches(record, clause),
      );
    }
    const value = getPath(record, key);
    if (expected && typeof expected === 'object' && '$exists' in expected) {
      return (value !== undefined) === Boolean(expected.$exists);
    }
    return value === expected;
  });
}

function applyUpdate(record: StoredNvr, update: Record<string, object>): void {
  for (const [path, value] of Object.entries(update.$set ?? {})) {
    setPath(record, path, value as string);
  }
  for (const path of Object.keys(update.$unset ?? {})) {
    deletePath(record, path);
  }
  if (update.$currentDate) record.updatedAt = new Date();
}

function getPath(record: StoredNvr, path: string): unknown {
  return path.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, record);
}

function setPath(record: StoredNvr, path: string, value: string): void {
  const [head, configType] = path.split('.');
  if (configType === undefined) {
    record.runningConfigs = value as unknown as Record<string, string>;
    return;
  }
  if (head !== 'runningConfigs') return;
  record.runningConfigs[configType] = value;
}

function deletePath(record: StoredNvr, path: string): void {
  const [, configType] = path.split('.');
  delete record.runningConfigs[configType!];
}
