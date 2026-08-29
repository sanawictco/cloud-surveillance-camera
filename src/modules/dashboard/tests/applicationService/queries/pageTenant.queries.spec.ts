import {
  FindPageByIdForTenantQuery,
  FindPageByIdForTenantQueryHandler,
} from '../../../applicationService/queries/findPageById.queryHandler';
import {
  FindAllPagesForTenantQuery,
  FindAllPagesForTenantQueryHandler,
} from '../../../applicationService/queries/findAllPages.queryHandler';

describe('Page tenant queries', () => {
  it('requires a tenant on the id query', () => {
    expect(() => new FindPageByIdForTenantQuery('', ['nvr-1'], 'page-1')).toThrow(
      'tenantId is required',
    );
  });

  it('finds a page only inside the requested tenant and its NVRs', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(undefined) };
    const handler = new FindPageByIdForTenantQueryHandler(repo as never);

    await handler.execute(
      new FindPageByIdForTenantQuery('tenant-a', ['nvr-1'], 'page-1'),
    );

    expect(repo.findOne).toHaveBeenCalledWith('tenant-a', {
      $and: [{ id: 'page-1' }, { nvrId: { $in: ['nvr-1'] } }],
    });
  });

  it('returns nothing for a tenant that owns no NVRs', async () => {
    const repo = { findOne: jest.fn() };
    const handler = new FindPageByIdForTenantQueryHandler(repo as never);

    const result = await handler.execute(
      new FindPageByIdForTenantQuery('tenant-a', [], 'page-1'),
    );

    expect(result).toBeUndefined();
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('passes the tenant into the repository for list queries', async () => {
    const repo = { findAll: jest.fn().mockResolvedValue([]) };
    const handler = new FindAllPagesForTenantQueryHandler(repo as never);

    await handler.execute(
      new FindAllPagesForTenantQuery('tenant-a', ['nvr-1']),
    );

    expect(repo.findAll).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        filter: { $and: [{ nvrId: { $in: ['nvr-1'] } }, {}] },
      }),
    );
  });
});
