import { Test, TestingModule } from '@nestjs/testing';
import { SystemMonitorController } from '../systemMonitor.controller';
import { SystemMonitorService } from '../systemMonitor.service';

describe('SystemMonitorController', () => {
  let controller: SystemMonitorController;
  let service: { getHealthStatus: jest.Mock };

  beforeEach(async () => {
    service = {
      getHealthStatus: jest.fn().mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toLocaleString(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemMonitorController],
      providers: [{ provide: SystemMonitorService, useValue: service }],
    }).compile();

    controller = module.get(SystemMonitorController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /system-monitor/health', () => {
    it('should delegate to SystemMonitorService.getHealthStatus', async () => {
      await controller.getHealthStatus();

      expect(service.getHealthStatus).toHaveBeenCalledTimes(1);
    });

    it('should return the health status from the service', async () => {
      const expected = {
        status: 'healthy',
        timestamp: '2026-07-11 10:00:00',
      };
      service.getHealthStatus.mockResolvedValue(expected);

      const result = await controller.getHealthStatus();

      expect(result).toEqual(expected);
    });

    it('should propagate exceptions from the service', async () => {
      service.getHealthStatus.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(controller.getHealthStatus()).rejects.toThrow(
        'Service unavailable',
      );
    });
  });
});
