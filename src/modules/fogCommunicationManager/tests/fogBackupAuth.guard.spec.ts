import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { FogBackupAuthGuard } from '../fogBackupAuth.guard';

describe('FogBackupAuthGuard', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const serialNumber = 'NVR00001';
  const accessToken = '1'.repeat(32);

  function buildGuard() {
    const fogApi = {
      findFogNvrBySerialNumber: jest.fn().mockResolvedValue({
        id: '22222222-2222-4222-8222-222222222222',
        tenantId,
        serialNumber,
        accessToken,
        cloudIsRecovering: false,
      }),
    };
    const request = {
      headers: {
        'x-tenant-id': tenantId,
        'x-nvr-serial-number': serialNumber,
        'x-nvr-access-token': accessToken,
      },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return {
      guard: new FogBackupAuthGuard(fogApi as never),
      fogApi,
      request,
      context,
    };
  }

  it('attaches the authenticated NVR scope before upload handling', async () => {
    const context = buildGuard();

    await expect(context.guard.canActivate(context.context)).resolves.toBe(
      true,
    );

    expect(context.request).toEqual(
      expect.objectContaining({
        fogNvr: expect.objectContaining({ tenantId, serialNumber }),
      }),
    );
  });

  it('rejects a tenant mismatch', async () => {
    const context = buildGuard();
    context.request.headers['x-tenant-id'] =
      '33333333-3333-4333-8333-333333333333';

    await expect(
      context.guard.canActivate(context.context),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects malformed headers before NVR lookup', async () => {
    const context = buildGuard();
    context.request.headers['x-nvr-access-token'] = 'short';

    await expect(
      context.guard.canActivate(context.context),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(context.fogApi.findFogNvrBySerialNumber).not.toHaveBeenCalled();
  });
});
