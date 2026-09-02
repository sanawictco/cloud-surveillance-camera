import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';

export class FindCameraByIdForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindCameraByIdForTenantQuery)
export class FindCameraByIdForTenantQueryHandler implements IQueryHandler<FindCameraByIdForTenantQuery> {
  constructor(
    @Inject(CAMERA_REPOSITORY)
    private readonly cameraRepo: CameraRepository,
  ) {}

  execute(query: FindCameraByIdForTenantQuery) {
    return this.cameraRepo.findOne({
      $and: [{ tenantId: query.tenantId }, { id: query.id }],
    });
  }
}
