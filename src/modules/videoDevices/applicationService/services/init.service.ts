import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { RestoreCamerasToCacheCommand } from '../commands/camera/restoreCamerasToCache.command';
import { FindAllNvrsQuery } from '../queries/nvr/findAllNvrs.queryHandler';
import { NvrLiveSignalService } from './liveSignals/nvrLiveSignal.service';
import { RestoreNvrsToCacheCommand } from '../commands/nvr/restoreNvrsToCache.command';
import { NvrEntity } from '../../domain/nvr/nvr.entity';

@Injectable()
export class VideoDeviceInitService implements OnApplicationBootstrap {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly nvrLiveSignalService: NvrLiveSignalService,
  ) {}
  async onApplicationBootstrap() {
    await this._loadAllVideoDevicesToCacheAndSetupLiveSignalForActiveNvrs();
  }

  private async _loadAllVideoDevicesToCacheAndSetupLiveSignalForActiveNvrs() {
    await this.serviceProvider.commandBus.execute(
      new RestoreNvrsToCacheCommand(),
    );
    const nvrEntities: NvrEntity[] =
      await this.serviceProvider.queryBus.execute(new FindAllNvrsQuery());
    for (const nvrEntity of nvrEntities) {
      if (nvrEntity.getProps().isActive)
        await this.nvrLiveSignalService.start(nvrEntity);
    }
    await this.serviceProvider.commandBus.execute(
      new RestoreCamerasToCacheCommand(),
    );
  }
}
