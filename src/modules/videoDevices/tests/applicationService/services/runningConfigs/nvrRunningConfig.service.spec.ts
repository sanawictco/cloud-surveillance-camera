import { BadRequestException } from '@nestjs/common';
import { NvrRunningConfigService } from '../../../../applicationService/services/runningConfigs/nvrRunningConfig.service';
import { NvrEntity } from '../../../../domain/nvr/nvr.entity';
import { NvrConfigs } from '../../../../domain/nvr/nvr.type';

describe('NvrRunningConfigService', () => {
  function buildService() {
    const nvr = NvrEntity.create({
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken: '11111111111111111111111111111111',
      maxCameras: 16,
      password: 'nvr-password',
    });
    nvr.update({ runningConfigs: { search: 'stale-search-msg' } });
    const queue = {
      addRepeatableMsg: jest.fn().mockImplementation(({ msgId }) => msgId),
      getRepeatableMsg: jest.fn(),
      getAndDeleteRepeatableMsg: jest.fn(),
    };
    const commandBus = {
      execute: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true),
    };
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue(nvr) },
      logger: { warn: jest.fn(), error: jest.fn() },
    };
    const service = new NvrRunningConfigService(
      queue as never,
      {} as never,
      serviceProvider as never,
      commandBus as never,
    );
    return { service, nvr, queue, commandBus };
  }

  it('clears a stale search claim before admitting register', async () => {
    const context = buildService();
    context.queue.getRepeatableMsg.mockResolvedValue(undefined);

    await expect(
      context.service.runConfigIfNotDuplicated(
        context.nvr,
        NvrConfigs.REGISTER,
        {},
        'register-msg',
      ),
    ).resolves.toBe('register-msg');

    expect(context.commandBus.execute).toHaveBeenCalledTimes(3);
    expect(context.commandBus.execute.mock.calls[1]![0]).toEqual(
      expect.objectContaining({
        id: context.nvr.id,
        mutation: {
          operation: 'unsetIfMatches',
          configType: NvrConfigs.SEARCH,
          msgId: 'stale-search-msg',
        },
      }),
    );
    expect(context.queue.addRepeatableMsg).toHaveBeenCalled();
  });

  it('keeps an active search claim and rejects register', async () => {
    const context = buildService();
    context.queue.getRepeatableMsg.mockResolvedValue({
      msgId: 'stale-search-msg',
    });

    await expect(
      context.service.runConfigIfNotDuplicated(
        context.nvr,
        NvrConfigs.REGISTER,
        {},
        'register-msg',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(context.commandBus.execute).toHaveBeenCalledTimes(1);
    expect(context.queue.addRepeatableMsg).not.toHaveBeenCalled();
  });
});
