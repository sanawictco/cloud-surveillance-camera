import { FindCameraByIdForTenantQueryHandler } from '../../../applicationService/queries/camera/findCameraById.queryHandler';
import { FindAllNvrsForTenantQueryHandler } from '../../../applicationService/queries/nvr/findAllNvrs.queryHandler';

describe('Tenant-scoped video device queries', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  it('places tenant and NVR filters in an unavoidable $and', async () => {
    const repository = { findAll: jest.fn().mockResolvedValue([]) };
    const handler = new FindAllNvrsForTenantQueryHandler(repository as never);

    await handler.execute({
      tenantId,
      filter: { name: 'NVR' },
      orderBy: undefined,
    });

    expect(repository.findAll).toHaveBeenCalledWith({
      filter: { $and: [{ tenantId }, { name: 'NVR' }] },
      orderBy: undefined,
    });
  });

  it('places tenant and camera ID filters in an unavoidable $and', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(undefined) };
    const handler = new FindCameraByIdForTenantQueryHandler(
      repository as never,
    );

    await handler.execute({ tenantId, id: 'camera-id' });

    expect(repository.findOne).toHaveBeenCalledWith({
      $and: [{ tenantId }, { id: 'camera-id' }],
    });
  });
});
