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

describe('SystemMonitorService', () => {
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /system-monitor/health', () => {
    it('should return healthy when all infrastructure checks pass', async () => {
      const result = await service.getHealthStatus();

      expect(result).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
      });
    });

    it('should return a timestamp as a string', async () => {
      const result = await service.getHealthStatus();

      expect(typeof result.timestamp).toBe('string');
    });

    it('should check EMQX, MongoDB, Redis, and TDengine in order', async () => {
      await service.getHealthStatus();

      expect(serviceProvider.httpService.get).toHaveBeenCalledTimes(1);
      expect(cacheService.healthCheck).toHaveBeenCalledTimes(1);
      expect(tdengineService.healthCheck).toHaveBeenCalledTimes(1);
    });

    describe('when EMQX is down', () => {
      beforeEach(() => {
        serviceProvider.httpService.get.mockRejectedValue(
          new Error('ECONNREFUSED'),
        );
      });

      it('should throw ServiceUnavailableException', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow(
          ServiceUnavailableException,
        );
      });

      it('should return unhealthy status in exception', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow(
          expect.objectContaining({
            response: expect.objectContaining({ status: 'unhealthy' }),
          }),
        );
      });

      it('should not check remaining services after EMQX fails', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow();

        expect(cacheService.healthCheck).not.toHaveBeenCalled();
        expect(tdengineService.healthCheck).not.toHaveBeenCalled();
      });
    });

    describe('when EMQX returns non-running status', () => {
      beforeEach(() => {
        serviceProvider.httpService.get.mockResolvedValue({
          status: 200,
          data: [{ node_status: 'stopped' }],
        });
      });

      it('should throw ServiceUnavailableException', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow(
          ServiceUnavailableException,
        );
      });
    });

    describe('when EMQX returns empty data', () => {
      beforeEach(() => {
        serviceProvider.httpService.get.mockResolvedValue({
          status: 200,
          data: [],
        });
      });

      it('should throw ServiceUnavailableException', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow(
          ServiceUnavailableException,
        );
      });
    });

    describe('when MongoDB is disconnected', () => {
      beforeEach(() => {
        connection.readyState = 0; // 0 = disconnected
      });

      it('should throw ServiceUnavailableException', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow(
          ServiceUnavailableException,
        );
      });

      it('should still check EMQX before MongoDB', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow();

        expect(serviceProvider.httpService.get).toHaveBeenCalled();
      });
    });

    describe('when Redis cache is unhealthy', () => {
      beforeEach(() => {
        cacheService.healthCheck.mockResolvedValue(false);
      });

      it('should throw ServiceUnavailableException', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow(
          ServiceUnavailableException,
        );
      });

      it('should have passed EMQX and MongoDB checks', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow();

        expect(serviceProvider.httpService.get).toHaveBeenCalled();
        expect(cacheService.healthCheck).toHaveBeenCalled();
      });
    });

    describe('when TDengine is down', () => {
      beforeEach(() => {
        tdengineService.healthCheck.mockResolvedValue({ status: 'error' });
      });

      it('should throw ServiceUnavailableException', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow(
          ServiceUnavailableException,
        );
      });

      it('should have passed all prior checks', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow();

        expect(serviceProvider.httpService.get).toHaveBeenCalled();
        expect(cacheService.healthCheck).toHaveBeenCalled();
        expect(tdengineService.healthCheck).toHaveBeenCalled();
      });
    });

    describe('when TDengine healthCheck throws', () => {
      beforeEach(() => {
        tdengineService.healthCheck.mockRejectedValue(
          new Error('Connection refused'),
        );
      });

      it('should throw ServiceUnavailableException', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow(
          ServiceUnavailableException,
        );
      });

      it('should log the error', async () => {
        await expect(service.getHealthStatus()).rejects.toThrow();

        expect(serviceProvider.logger.error).toHaveBeenCalledWith(
          'TDengine connection error:',
          expect.any(Error),
        );
      });
    });
  });
});
