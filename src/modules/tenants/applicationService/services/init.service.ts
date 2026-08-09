import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { RestoreTenantsToCacheCommand } from '../commands/restoreTenantsToCache.command';

@Injectable()
export class TenantInitService implements OnApplicationBootstrap {
  constructor(private readonly serviceProvider: ServiceProvider) {}

  async onApplicationBootstrap() {
    await this.serviceProvider.commandBus.execute(
      new RestoreTenantsToCacheCommand(),
    );
  }
}
