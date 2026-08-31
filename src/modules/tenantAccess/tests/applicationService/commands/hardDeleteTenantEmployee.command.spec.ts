import { BadRequestException } from '@nestjs/common';
import {
  HardDeleteTenantEmployeeCommand,
  HardDeleteTenantEmployeeCommandHandler,
} from '../../../applicationService/commands/tenantAccess.commands';

const tenantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '44444444-4444-4444-8444-444444444444';
const userId = '33333333-3333-4333-8333-333333333333';

function command() {
  return new HardDeleteTenantEmployeeCommand(tenantId, employeeId);
}

function handlerWith(overrides: {
  employee?: Record<string, unknown> | undefined;
  deleteResult?: boolean;
}) {
  const employeeRepository = {
    findByIdForTenant: jest
      .fn()
      .mockResolvedValue(
        'employee' in overrides
          ? overrides.employee
          : { id: employeeId, userId, isDeleted: true },
      ),
    delete: jest.fn().mockResolvedValue(overrides.deleteResult ?? true),
  };
  const tenantAccessRepository = {
    findTenant: jest
      .fn()
      .mockResolvedValue({
        id: tenantId,
        ownerId: '55555555-5555-4555-8555-555555555555',
      }),
    deleteSmsNotifier: jest.fn().mockResolvedValue(true),
  };
  const actorLogApiService = {
    deleteActorLogs: jest.fn().mockResolvedValue(undefined),
  };
  const handler = new HardDeleteTenantEmployeeCommandHandler(
    employeeRepository as never,
    tenantAccessRepository as never,
    actorLogApiService as never,
  );
  return {
    handler,
    employeeRepository,
    tenantAccessRepository,
    actorLogApiService,
  };
}

describe('HardDeleteTenantEmployeeCommandHandler', () => {
  it('row-deletes the removed member actor logs scoped to this tenant only', async () => {
    const { handler, actorLogApiService } = handlerWith({});
    const employee = await handler.execute(command());

    expect(actorLogApiService.deleteActorLogs).toHaveBeenCalledTimes(1);
    expect(actorLogApiService.deleteActorLogs).toHaveBeenCalledWith(tenantId, [
      userId,
    ]);
    expect(employee.userId).toBe(userId);
  });

  it('still deletes the member SMS notifier before the actor logs', async () => {
    const { handler, tenantAccessRepository, actorLogApiService } = handlerWith(
      {},
    );

    await handler.execute(command());

    expect(tenantAccessRepository.deleteSmsNotifier).toHaveBeenCalledWith(
      tenantId,
      userId,
    );
    const smsCallOrder =
      tenantAccessRepository.deleteSmsNotifier.mock.invocationCallOrder[0];
    const actorLogCallOrder =
      actorLogApiService.deleteActorLogs.mock.invocationCallOrder[0];
    expect(smsCallOrder).toBeLessThan(actorLogCallOrder);
  });

  it('deletes no actor logs when the membership row is missing', async () => {
    const { handler, actorLogApiService } = handlerWith({
      employee: undefined,
    });

    await expect(handler.execute(command())).rejects.toThrow(
      BadRequestException,
    );
    expect(actorLogApiService.deleteActorLogs).not.toHaveBeenCalled();
  });

  it('deletes no actor logs when the member is not soft-deleted yet', async () => {
    const { handler, actorLogApiService } = handlerWith({
      employee: { id: employeeId, userId, isDeleted: false },
    });

    await expect(handler.execute(command())).rejects.toThrow(
      BadRequestException,
    );
    expect(actorLogApiService.deleteActorLogs).not.toHaveBeenCalled();
  });
});
