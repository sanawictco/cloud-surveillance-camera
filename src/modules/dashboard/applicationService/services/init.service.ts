import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { RestorePagesToCacheCommand } from '../commands/restorePagesToCache.command';

@Injectable()
export class DashboardInitService implements OnApplicationBootstrap {
  constructor(private readonly serviceProvider: ServiceProvider) {}
  onApplicationBootstrap() {
    setTimeout(async () => {
      await this.serviceProvider.commandBus.execute(
        new RestorePagesToCacheCommand(),
      );
    }, 3000);
  }
}
