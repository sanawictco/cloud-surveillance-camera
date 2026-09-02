import { BadRequestException } from '@nestjs/common';
import {
  RecoverTenantEmployeeCommand,
  RecoverTenantEmployeeCommandHandler,
} from '../../../applicationService/commands/tenantAccess.commands';

const tenantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '44444444-4444-4444-8444-444444444444';
const userId = '33333333-3333-4333-8333-333333333333';
const ownerId = '55555555-5555-4555-8555-555555555555';

function command() {
  return new RecoverTenantEmployeeCommand(tenantId, employeeId);
}

function handlerWith(overrides: {
  employee?: Record<string, unknown> | undefined;
  tenant?: Record<string, unknown> | undefined;
}) {
  const employee =
    'employee' in overrides
      ? overrides.employee
      : { id: employeeId, userId, isDeleted: true };
  const employeeRepository = {
    findByIdForTenant: jest.fn().mockResolvedValue(employee),
    setDeleted: jest
      .fn()
      .mockResolvedValue({ id: employeeId, userId, isDeleted: false }),
  };
  const tenantAccessRepository = {
    findTenant: jest
      .fn()
      .mockResolvedValue(
        'tenant' in overrides ? overrides.tenant : { id: tenantId, ownerId },
      ),
  };
  const handler = new RecoverTenantEmployeeCommandHandler(
    employeeRepository as never,
    tenantAccessRepository as never,
  );
  return { handler, employeeRepository, tenantAccessRepository };
}

describe('RecoverTenantEmployeeCommandHandler', () => {
  it('recovers a removed non-owner employee', async () => {
    const { handler, employeeRepository } = handlerWith({});

    const recovered = await handler.execute(command());

    expect(employeeRepository.setDeleted).toHaveBeenCalledWith(
      tenantId,
      employeeId,
      false,
    );
    expect(recovered.isDeleted).toBe(false);
  });

  it('refuses to mutate the tenant owner employee, like its delete siblings', async () => {
    const { handler, employeeRepository } = handlerWith({
      employee: { id: employeeId, userId: ownerId, isDeleted: true },
    });

    await expect(handler.execute(command())).rejects.toThrow(
      BadRequestException,
    );
    expect(employeeRepository.setDeleted).not.toHaveBeenCalled();
  });

  it('rejects a missing employee without writing', async () => {
    const { handler, employeeRepository } = handlerWith({
      employee: undefined,
    });

    await expect(handler.execute(command())).rejects.toThrow(
      BadRequestException,
    );
    expect(employeeRepository.setDeleted).not.toHaveBeenCalled();
  });

  it('rejects a missing tenant without writing', async () => {
    const { handler, employeeRepository } = handlerWith({ tenant: undefined });

    await expect(handler.execute(command())).rejects.toThrow(
      BadRequestException,
    );
    expect(employeeRepository.setDeleted).not.toHaveBeenCalled();
  });
});
