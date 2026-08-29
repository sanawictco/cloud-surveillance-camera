import { PageRepository } from '../../../infra/repositories/page.repository';
import { pageCacheKey } from '../../../infra/schemas/page.schema';

function leanChain(result: unknown) {
  return { lean: jest.fn().mockResolvedValue(result) };
}

describe('PageRepository tenant scope', () => {
  function build() {
    const model = {
      findOne: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    const cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const mapper = { toDomain: jest.fn((record) => ({ record })) };
    const serviceProvider = { logger: {}, eventEmitter: {} };
    const repo = new PageRepository(
      model as never,
      mapper as never,
      cache as never,
      serviceProvider as never,
    );
    return { repo, model, cache, mapper };
  }

  it('findById fails closed without a tenant', async () => {
    const { repo } = build();
    await expect(repo.findById('', 'page-1')).rejects.toThrow(
      'tenantId is required',
    );
  });

  it('findById filters by tenant on a cache miss', async () => {
    const { repo, model } = build();
    model.findOne.mockReturnValue(leanChain(undefined));

    await repo.findById('tenant-a', 'page-1');

    expect(model.findOne).toHaveBeenCalledWith({
      $and: [{ tenantId: 'tenant-a' }, { id: 'page-1' }],
    });
  });

  it('findById ignores a cached record owned by another tenant', async () => {
    const { repo, model, cache } = build();
    cache.get.mockResolvedValue({ tenantId: 'tenant-b', id: 'page-1' });
    model.findOne.mockReturnValue(leanChain(undefined));

    const result = await repo.findById('tenant-a', 'page-1');

    expect(result).toBeUndefined();
    // A warm cache hit for a foreign tenant must fall through to a
    // tenant-filtered DB read, never be returned directly.
    expect(model.findOne).toHaveBeenCalledWith({
      $and: [{ tenantId: 'tenant-a' }, { id: 'page-1' }],
    });
  });

  it('findById uses a tenant-prefixed cache key', async () => {
    const { repo, cache } = build();
    cache.get.mockResolvedValue({ tenantId: 'tenant-a', id: 'page-1' });

    await repo.findById('tenant-a', 'page-1');

    expect(cache.get).toHaveBeenCalledWith(pageCacheKey('tenant-a', 'page-1'));
  });

  it('writes the same cache key that external evictors build', async () => {
    const { repo, model, cache } = build();
    model.findOneAndUpdate.mockReturnValue(
      leanChain({ tenantId: 'tenant-a', id: 'page-1' }),
    );
    const entity = {
      id: 'page-1',
      getProps: () => ({ tenantId: 'tenant-a', id: 'page-1' }),
      publishEvents: jest.fn(),
    };

    await repo.update(entity as never);

    // The fog restore path evicts with pageCacheKey(); if the repository ever
    // writes a different key, eviction silently no-ops and serves stale pages.
    expect(cache.set).toHaveBeenCalledWith(
      pageCacheKey('tenant-a', 'page-1'),
      expect.anything(),
    );
  });

  it('derives a deterministic _id from the aggregate UUID on insert', async () => {
    const { repo, cache } = build();
    const saved: Record<string, unknown>[] = [];
    class FakeModel {
      constructor(public doc: Record<string, unknown>) {
        saved.push(doc);
      }
      save() {
        return Promise.resolve();
      }
    }
    const repoWithCtor = new PageRepository(
      FakeModel as never,
      { toDomain: jest.fn() } as never,
      cache as never,
      { logger: {}, eventEmitter: {} } as never,
    );
    void repo;
    const id = '11111111-2222-4333-8444-555555555555';
    await repoWithCtor.insert({
      id,
      getProps: () => ({ tenantId: 'tenant-a', id }),
      publishEvents: jest.fn(),
    } as never);

    // Fog cloud-recovery upserts depend on a stable _id, not a random ObjectId.
    expect(saved[0]!._id).toBe('111111112222433384445555');
  });

  it('findOne merges the caller filter under the tenant with $and', async () => {
    const { repo, model } = build();
    model.findOne.mockReturnValue(leanChain(undefined));

    await repo.findOne('tenant-a', { name: 'Home' });

    expect(model.findOne).toHaveBeenCalledWith({
      $and: [{ tenantId: 'tenant-a' }, { name: 'Home' }],
    });
  });

  it('findAll scopes the query to the tenant', async () => {
    const { repo, model } = build();
    const query = { find: jest.fn(), sort: jest.fn(), lean: jest.fn() };
    query.lean.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    model.find.mockReturnValue(query);

    await repo.findAll('tenant-a', {} as never);

    expect(model.find).toHaveBeenCalledWith({
      $and: [{ tenantId: 'tenant-a' }, {}],
    });
  });

  it('aggregate begins with an unavoidable tenant match', async () => {
    const { repo, model } = build();

    await repo.aggregate('tenant-a', { max: { $max: '$pageIndex' } });

    expect(model.aggregate).toHaveBeenCalledWith([
      { $match: { tenantId: 'tenant-a' } },
      { $group: { _id: '', max: { $max: '$pageIndex' } } },
    ]);
  });

  it('update scopes by tenant and refuses a foreign-tenant no-op', async () => {
    const { repo, model } = build();
    model.findOneAndUpdate.mockReturnValue(leanChain(undefined));
    const entity = {
      id: 'page-1',
      getProps: () => ({ tenantId: 'tenant-a', id: 'page-1' }),
      publishEvents: jest.fn(),
    };

    await expect(repo.update(entity as never)).rejects.toThrow(
      'page page-1 not found for its tenant on update',
    );
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { $and: [{ tenantId: 'tenant-a' }, { id: 'page-1' }] },
      expect.objectContaining({ tenantId: 'tenant-a', id: 'page-1' }),
      { new: true },
    );
  });

  it('delete scopes by tenant and refuses a foreign-tenant no-op', async () => {
    const { repo, model } = build();
    model.deleteOne.mockResolvedValue({ deletedCount: 0 });
    const entity = {
      id: 'page-1',
      getProps: () => ({ tenantId: 'tenant-a', id: 'page-1' }),
      publishEvents: jest.fn(),
    };

    await expect(repo.delete(entity as never)).rejects.toThrow(
      'page page-1 not found for its tenant on delete',
    );
    expect(model.deleteOne).toHaveBeenCalledWith({
      $and: [{ tenantId: 'tenant-a' }, { id: 'page-1' }],
    });
  });

  it('unlockRunningConfig scopes the mutation to the tenant', async () => {
    const { repo, model } = build();
    model.findOneAndUpdate.mockReturnValue({
      lean: () => ({ exec: jest.fn().mockResolvedValue(undefined) }),
    });

    const result = await repo.unlockRunningConfig(
      'tenant-a',
      'page-1',
      'nvr-1',
      'UPDATE_PAGE' as never,
      '42',
    );

    expect(result).toBe(false);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {
        $and: [
          { tenantId: 'tenant-a' },
          {
            id: 'page-1',
            nvrId: 'nvr-1',
            'runningConfigs.UPDATE_PAGE': '42',
          },
        ],
      },
      { $unset: { 'runningConfigs.UPDATE_PAGE': '' } },
      { new: true },
    );
  });
});
