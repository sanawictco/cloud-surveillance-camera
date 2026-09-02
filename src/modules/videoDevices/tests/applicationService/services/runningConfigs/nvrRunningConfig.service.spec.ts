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
    nvr.update({ runningConfigs: { search: '101' } });
    const queue = {
      reserveMsgId: jest.fn().mockImplementation(({ msgId }) => msgId),
      addReservedRepeatableMsg: jest
        .fn()
        .mockImplementation(({ msgId }) => msgId),
      releaseMsgIdReservation: jest.fn(),
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
    return { service, nvr, queue, commandBus, serviceProvider };
  }

  it('clears a stale search claim before admitting register', async () => {
    const context = buildService();
    context.queue.getRepeatableMsg.mockResolvedValue(undefined);

    await expect(
      context.service.runConfigIfNotDuplicated(
        context.nvr,
        NvrConfigs.REGISTER,
        {},
        '202',
      ),
    ).resolves.toBe('202');

    expect(context.commandBus.execute).toHaveBeenCalledTimes(3);
    expect(context.commandBus.execute.mock.calls[1]![0]).toEqual(
      expect.objectContaining({
        id: context.nvr.id,
        mutation: {
          operation: 'unsetIfMatches',
          configType: NvrConfigs.SEARCH,
          msgId: '101',
        },
      }),
    );
    expect(context.queue.addReservedRepeatableMsg).toHaveBeenCalled();
  });

  it('keeps an active search claim and rejects register', async () => {
    const context = buildService();
    context.queue.getRepeatableMsg.mockResolvedValue({
      msgId: '101',
    });

    await expect(
      context.service.runConfigIfNotDuplicated(
        context.nvr,
        NvrConfigs.REGISTER,
        {},
        '202',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(context.commandBus.execute).toHaveBeenCalledTimes(1);
    expect(context.queue.addReservedRepeatableMsg).not.toHaveBeenCalled();
    expect(context.queue.releaseMsgIdReservation).toHaveBeenCalledWith(
      context.nvr.getProps().tenantId,
      context.nvr.id,
      '202',
    );
  });

  it('stops cleanly when the NVR is deleted during the re-fetch', async () => {
    const context = buildService();
    // A concurrent delete wins the race, so the tenant-scoped re-fetch inside
    // stopAndRemoveAllRunningConfigs resolves to undefined.
    context.serviceProvider.queryBus.execute.mockResolvedValue(undefined);

    await expect(
      context.service.stopAndRemoveAllRunningConfigs(context.nvr),
    ).resolves.toBeUndefined();

    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(context.commandBus.execute).not.toHaveBeenCalled();
  });
});
