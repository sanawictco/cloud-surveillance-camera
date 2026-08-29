import { PageRunningConfigService } from '../../../applicationService/services/pageRunningConfig.service';
import { UnlockPageRunningConfigCommand } from '../../../applicationService/commands/unlockPageRunningConfig.command';
import { PageConfigs } from '../../../domain/page.type';

function buildService(executeResult: boolean) {
  const execute = jest.fn().mockResolvedValue(executeResult);
  const serviceProvider = { commandBus: { execute } };
  const service = new PageRunningConfigService(
    serviceProvider as never,
    {} as never,
  );
  return { service, execute };
}

const page = {
  getProps: () => ({ id: 'page-id', nvrId: 'nvr-id' }),
};

describe('PageRunningConfigService', () => {
  it('unlocks only the scoped operation that still owns the msgId', async () => {
    const { service, execute } = buildService(false);

    await expect(
      service.doneAndUnLockConfig(
        page as never,
        'tenant-a',
        PageConfigs.UPDATE_PAGE,
        '101',
      ),
    ).resolves.toBe(false);

    expect(execute).toHaveBeenCalledTimes(1);
    const command = execute.mock.calls[0][0] as UnlockPageRunningConfigCommand;
    expect(command).toBeInstanceOf(UnlockPageRunningConfigCommand);
    expect(command).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-a',
        id: 'page-id',
        nvrId: 'nvr-id',
        configType: PageConfigs.UPDATE_PAGE,
        msgId: '101',
      }),
    );
  });

  it('atomically unlocks a failed page deletion', async () => {
    const { service, execute } = buildService(true);

    await expect(
      service.doneAndUnLockConfig(
        page as never,
        'tenant-a',
        PageConfigs.DELETE_PAGE,
        '101',
      ),
    ).resolves.toBe(true);

    const command = execute.mock.calls[0][0] as UnlockPageRunningConfigCommand;
    expect(command).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-a',
        id: 'page-id',
        nvrId: 'nvr-id',
        configType: PageConfigs.DELETE_PAGE,
        msgId: '101',
      }),
    );
  });

  it('fails closed when no tenant is provided', async () => {
    const { service, execute } = buildService(true);

    await expect(
      service.doneAndUnLockConfig(
        page as never,
        '',
        PageConfigs.DELETE_PAGE,
        '101',
      ),
    ).rejects.toThrow('tenantId is required');
    expect(execute).not.toHaveBeenCalled();
  });

  it('treats page creation as always unlocked without a command', async () => {
    const { service, execute } = buildService(true);

    await expect(
      service.doneAndUnLockConfig(
        page as never,
        'tenant-a',
        PageConfigs.CREATE_PAGE,
        '101',
      ),
    ).resolves.toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
});
