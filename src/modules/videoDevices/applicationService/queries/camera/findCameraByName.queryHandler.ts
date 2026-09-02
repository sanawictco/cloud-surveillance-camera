import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';

export class FindCameraByNameForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly name: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindCameraByNameForTenantQuery)
export class FindCameraByNameForTenantQueryHandler implements IQueryHandler<FindCameraByNameForTenantQuery> {
  constructor(
    @Inject(CAMERA_REPOSITORY)
    private readonly cameraRepo: CameraRepository,
  ) {}

  execute(query: FindCameraByNameForTenantQuery) {
    return this.cameraRepo.findOne({
      $and: [{ tenantId: query.tenantId }, { name: query.name }],
    });
  }
}
