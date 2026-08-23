import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CameraIdsRequestDto } from '../../../contracts/camera/http/cameras.request.dto';

const firstCameraId = '11111111-1111-4111-8111-111111111111';
const secondCameraId = '22222222-2222-4222-8222-222222222222';

describe('CameraIdsRequestDto', () => {
  it('transforms comma-separated camera IDs from a query parameter', () => {
    const dto = plainToInstance(CameraIdsRequestDto, {
      cameraIds: `${firstCameraId},${secondCameraId}`,
    });

    expect(dto.cameraIds).toEqual([firstCameraId, secondCameraId]);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('preserves camera ID arrays', () => {
    const dto = plainToInstance(CameraIdsRequestDto, {
      cameraIds: [firstCameraId, secondCameraId],
    });

    expect(dto.cameraIds).toEqual([firstCameraId, secondCameraId]);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects invalid camera IDs', () => {
    const dto = plainToInstance(CameraIdsRequestDto, {
      cameraIds: 'invalid-camera-id',
    });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
