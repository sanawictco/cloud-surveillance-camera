import {
  CreateTenantCommand,
  CreateTenantCommandHandler,
} from '../../../applicationService/commands/createTenant.command';
import { TenantStatuses } from '../../../domain/valueObjects/tenantStatus.vo';

const ownerId = '78c12077-7c5e-46f6-8a05-b3df96c94c2d';

function command() {
  return new CreateTenantCommand({
    ownerId,
    name: 'Sanaw',
    status: TenantStatuses.ACTIVE,
    defaultTimezone: 'Asia/Tehran',
  });
}

function handlerWith(overrides: {
  createOwnerEmployee?: jest.Mock;
  delete?: jest.Mock;
}) {
  const tenantRepo = {
    insert: jest.fn().mockResolvedValue(undefined),
    delete: overrides.delete ?? jest.fn().mockResolvedValue(undefined),
  };
  const tenantAccessService = {
    createOwnerEmployee:
      overrides.createOwnerEmployee ?? jest.fn().mockResolvedValue({}),
  };
  const handler = new CreateTenantCommandHandler(
    tenantRepo as never,
    tenantAccessService as never,
  );
  return { handler, tenantRepo, tenantAccessService };
}

describe('CreateTenantCommandHandler', () => {
  it('creates the tenant and its owner employee', async () => {
    const { handler, tenantRepo, tenantAccessService } = handlerWith({});

    const tenantId = await handler.execute(command());

    expect(tenantRepo.insert).toHaveBeenCalledTimes(1);
    expect(tenantAccessService.createOwnerEmployee).toHaveBeenCalledWith(
      tenantId,
      ownerId,
    );
    expect(tenantRepo.delete).not.toHaveBeenCalled();
  });

  it('rolls the tenant back when the owner employee cannot be created', async () => {
    const failure = new Error('employee write failed');
    const { handler, tenantRepo } = handlerWith({
      createOwnerEmployee: jest.fn().mockRejectedValue(failure),
    });

    await expect(handler.execute(command())).rejects.toThrow(failure);

    // Without the rollback the tenant row survives with zero employees, and
    // ActiveTenantGuard can then never grant access to it again.
    expect(tenantRepo.delete).toHaveBeenCalledTimes(1);
    const [deleted] = tenantRepo.delete.mock.calls[0];
    const [inserted] = tenantRepo.insert.mock.calls[0];
    expect(deleted.id).toBe(inserted.id);
  });

  it('surfaces the original failure even when the rollback itself fails', async () => {
    const failure = new Error('employee write failed');
    const { handler, tenantRepo } = handlerWith({
      createOwnerEmployee: jest.fn().mockRejectedValue(failure),
      delete: jest.fn().mockRejectedValue(new Error('rollback failed')),
    });

    await expect(handler.execute(command())).rejects.toThrow(failure);
    expect(tenantRepo.delete).toHaveBeenCalledTimes(1);
  });
});
