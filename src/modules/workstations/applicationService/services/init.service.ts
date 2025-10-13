import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { RestoreWorkstationToCacheCommand } from '../commands/restoreWorkstationsToCache.command';

@Injectable()
export class WorkstationInitService implements OnApplicationBootstrap {
  constructor(private readonly serviceProvider: ServiceProvider) {}
  async onApplicationBootstrap() {
    await this.serviceProvider.commandBus.execute(
      new RestoreWorkstationToCacheCommand(),
    );
  }
}
