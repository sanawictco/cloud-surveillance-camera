import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import AppConfig from 'configs/app.config';
import { Connection } from 'mongoose';
import { CacheService } from 'src/extensions/caching/cache.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { TDengineLifecycleService } from 'src/extensions/tdengine/tdengineLifecycle.service';
import { HealthResponseDto } from './dtos/health.response.dto';

// Upper bound for the EMQX admin-API health call so a hung/black-holed broker
// API cannot stall the whole /health response (and any liveness probe in front
// of it). On timeout axios throws and the check resolves to "unhealthy".
const HEALTH_CHECK_TIMEOUT_MS = 5000;

@Injectable()
export class SystemMonitorService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    protected readonly tdengineLifecycle: TDengineLifecycleService,
    private readonly serviceProvider: ServiceProvider,
    private readonly cacheService: CacheService<any>,
  ) {}
  // This service can be expanded with methods to monitor system health, performance, etc.
  async getHealthStatus(): Promise<HealthResponseDto> {
    if (
      (await this.checkEmqxConnection()) &&
      (await this._checkMongoDBConnection()) &&
      (await this.cacheService.healthCheck()) &&
      (await this._checkTDengineConnection())
    )
      return {
        status: 'healthy',
        timestamp: new Date().toLocaleString(),
      };
    throw new ServiceUnavailableException({
      status: 'unhealthy',
      timestamp: new Date().toLocaleString(),
    });
  }
  private async _checkMongoDBConnection(): Promise<boolean> {
    try {
      const state = this.connection.readyState;
      return state === 1; // 1 = connected
    } catch (error) {
      this.serviceProvider.logger.error('MongoDB connection error:', error);
      return false;
    }
  }

  private async _checkTDengineConnection(): Promise<boolean> {
    try {
      const result = await this.tdengineLifecycle.healthCheck();
      return result.status === 'ok';
    } catch (error) {
      this.serviceProvider.logger.error('TDengine connection error:', error);
      return false;
    }
  }

  async checkEmqxConnection(): Promise<boolean> {
    try {
      const response = await this.serviceProvider.httpService.get(
        `${AppConfig().mqtt.api.apiUrl}/nodes`,
        {
          auth: {
            username: AppConfig().mqtt.api.apiKey,
            password: AppConfig().mqtt.api.apiSecret,
          },
          timeout: HEALTH_CHECK_TIMEOUT_MS,
        },
      );
      return (
        response.status === 200 &&
        Array.isArray(response.data) &&
        response.data[0]?.node_status === 'running'
      );
    } catch (error) {
      this.serviceProvider.logger.error('EMQX connection error:', error);
      return false;
    }
  }
}
