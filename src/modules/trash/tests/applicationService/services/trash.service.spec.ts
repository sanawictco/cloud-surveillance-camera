jest.mock(
  'src/modules/videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForTrash.service',
  () => ({ VideoDevicesApiforTrashService: class {} }),
);
jest.mock(
  'src/modules/tenantAccess/applicationService/employeeAccess.http.service',
  () => ({
    EmployeeAccessHttpService: class {},
  }),
);
import { TrashService } from '../../../applicationService/services/trash.service';

describe('Trash contract: List soft-deleted items', () => {
  const cameras = [{ id: 'camera-1' }];
  const employees = [{ id: 'employee-1' }];

  const videoDevicesApi = {
    getSoftDeletedCameras: jest.fn(),
  };
  const employeesApi = {
    getSoftDeletedEmployees: jest.fn(),
  };
  const service = new TrashService(
    videoDevicesApi as ConstructorParameters<typeof TrashService>[0],
    employeesApi as ConstructorParameters<typeof TrashService>[1],
  );

  beforeEach(() => {
    jest.clearAllMocks();
    videoDevicesApi.getSoftDeletedCameras.mockResolvedValue(cameras);
    employeesApi.getSoftDeletedEmployees.mockResolvedValue(employees);
  });

  describe('Scenario: List all soft-deleted items', () => {
    // @spec TRASH-LIST-001-S01
    // @spec TRASH-SYNC-LEGACY-001-S01
    // @spec TRASH-FARM-001-S01
    it('WHEN trash endpoint is called THEN it aggregates soft-deleted items from all modules', async () => {
      await expect(service.find('tenant-a')).resolves.toEqual({
        cameras,
        employees,
      });

      expect(videoDevicesApi.getSoftDeletedCameras).toHaveBeenCalledTimes(1);
      expect(employeesApi.getSoftDeletedEmployees).toHaveBeenCalledTimes(1);
      expect(videoDevicesApi.getSoftDeletedCameras).toHaveBeenCalledWith(
        'tenant-a',
      );
    });

    it('propagates a provider failure instead of returning partial results', async () => {
      videoDevicesApi.getSoftDeletedCameras.mockRejectedValue(
        new Error('video devices unavailable'),
      );

      await expect(service.find('tenant-a')).rejects.toThrow(
        'video devices unavailable',
      );
    });
  });
});
