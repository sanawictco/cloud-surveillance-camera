/**
 * Contract test for SystemMonitor capability
 * Generated from: openspec/specs/systemMonitor/spec.md
 *
 * Scenario: System is healthy
 *   WHEN a client sends GET /system-monitor/health and all infrastructure connections are active
 *   THEN the system returns { status: 'healthy', timestamp }
 *
 * Scenario: System is unhealthy
 *   WHEN a client sends GET /system-monitor/health and one or more infrastructure connections are down
 *   THEN the system throws a ServiceUnavailableException with { status: 'healthy', timestamp }
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { SystemMonitorService } from '../systemMonitor.service';
import { Connection } from 'mongoose';
import { TDengineLifecycleService } from 'src/extensions/tdengine/tdengineLifecycle.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { CacheService } from 'src/extensions/caching/cache.service';

jest.mock('configs/app.config', () => ({
  __esModule: true,
  default: () => ({
    mqtt: {
      api: {
        apiUrl: 'http://emqx:18083',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      },
    },
  }),
}));

describe('SystemMonitor contract', () => {
  let service: SystemMonitorService;
  let connection: { readyState: number };
  let tdengineService: { healthCheck: jest.Mock };
  let serviceProvider: {
    httpService: { get: jest.Mock };
    logger: { error: jest.Mock };
  };
  let cacheService: { healthCheck: jest.Mock };

  beforeEach(async () => {
    connection = { readyState: 1 };
    tdengineService = {
      healthCheck: jest.fn().mockResolvedValue({ status: 'ok' }),
    };
    serviceProvider = {
      httpService: {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: [{ node_status: 'running' }],
        }),
      },
      logger: { error: jest.fn() },
    };
    cacheService = { healthCheck: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemMonitorService,
        { provide: 'DatabaseConnection', useValue: connection },
        { provide: TDengineLifecycleService, useValue: tdengineService },
        { provide: ServiceProvider, useValue: serviceProvider },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get(SystemMonitorService);
  });

  describe('Scenario: System is healthy', () => {
    it('WHEN all infrastructure connections are active THEN returns status healthy with timestamp', async () => {
      // ARRANGE — all checks pass (set in beforeEach)

      // ACT
      const result = await service.getHealthStatus();

      // ASSERT — THEN the system returns { status: 'healthy', timestamp }
      expect(result).toHaveProperty('status', 'healthy');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('Scenario: System is unhealthy', () => {
    it('WHEN EMQX is down THEN throws ServiceUnavailableException with status unhealthy', async () => {
      // ARRANGE
      serviceProvider.httpService.get.mockRejectedValue(
        new Error('ECONNREFUSED'),
      );

      // ACT + ASSERT — THEN throws ServiceUnavailableException
      await expect(service.getHealthStatus()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('WHEN MongoDB is disconnected THEN throws ServiceUnavailableException with status unhealthy', async () => {
      // ARRANGE
      connection.readyState = 0;

      // ACT + ASSERT
      await expect(service.getHealthStatus()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('WHEN Redis cache is unhealthy THEN throws ServiceUnavailableException with status unhealthy', async () => {
      // ARRANGE
      cacheService.healthCheck.mockResolvedValue(false);

      // ACT + ASSERT
      await expect(service.getHealthStatus()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('WHEN TDengine is down THEN throws ServiceUnavailableException with status unhealthy', async () => {
      // ARRANGE
      tdengineService.healthCheck.mockResolvedValue({ status: 'error' });

      // ACT + ASSERT
      await expect(service.getHealthStatus()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
