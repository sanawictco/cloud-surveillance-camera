import {
  MutateNvrRunningConfigCommand,
  MutateNvrRunningConfigCommandHandler,
} from '../../../../applicationService/commands/nvr/mutateNvrRunningConfig.command';
import { NvrConfigs } from '../../../../domain/nvr/nvr.type';

describe('MutateNvrRunningConfigCommandHandler', () => {
  it('delegates atomic provisioning admission to the repository', async () => {
    const repository = {
      claimProvisioningConfig: jest.fn().mockResolvedValue(true),
    };
    const handler = new MutateNvrRunningConfigCommandHandler(
      repository as never,
    );

    await expect(
      handler.execute(
        new MutateNvrRunningConfigCommand(
          'nvr-id',
          {
            operation: 'claimProvisioning',
            configType: NvrConfigs.SEARCH,
            msgId: 'search-msg',
          },
          'tenant-a',
        ),
      ),
    ).resolves.toBe(true);

    expect(repository.claimProvisioningConfig).toHaveBeenCalledWith(
      'nvr-id',
      NvrConfigs.SEARCH,
      'search-msg',
      'tenant-a',
    );
  });

  it('delegates conditional unlock to the repository', async () => {
    const repository = {
      unsetRunningConfigIfMatches: jest.fn().mockResolvedValue(true),
    };
    const handler = new MutateNvrRunningConfigCommandHandler(
      repository as never,
    );

    await expect(
      handler.execute(
        new MutateNvrRunningConfigCommand(
          'nvr-id',
          {
            operation: 'unsetIfMatches',
            configType: NvrConfigs.REGISTER,
            msgId: 'register-msg',
          },
          'tenant-a',
        ),
      ),
    ).resolves.toBe(true);

    expect(repository.unsetRunningConfigIfMatches).toHaveBeenCalledWith(
      'nvr-id',
      NvrConfigs.REGISTER,
      'register-msg',
      'tenant-a',
    );
  });

  it('always forwards the tenant scope to the repository', async () => {
    const repository = {
      setRunningConfig: jest.fn().mockResolvedValue(true),
      resetRunningConfigs: jest.fn().mockResolvedValue(true),
    };
    const handler = new MutateNvrRunningConfigCommandHandler(
      repository as never,
    );

    await handler.execute(
      new MutateNvrRunningConfigCommand(
        'nvr-id',
        {
          operation: 'set',
          configType: NvrConfigs.SEARCH,
          msgId: 'search-msg',
        },
        'tenant-a',
      ),
    );
    await handler.execute(
      new MutateNvrRunningConfigCommand(
        'nvr-id',
        { operation: 'reset' },
        'tenant-a',
      ),
    );

    expect(repository.setRunningConfig).toHaveBeenCalledWith(
      'nvr-id',
      NvrConfigs.SEARCH,
      'search-msg',
      'tenant-a',
    );
    expect(repository.resetRunningConfigs).toHaveBeenCalledWith(
      'nvr-id',
      'tenant-a',
    );
  });
});
