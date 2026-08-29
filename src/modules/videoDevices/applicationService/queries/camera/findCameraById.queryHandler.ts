import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';

export class FindCameraByIdQuery {
  constructor(public readonly id: string) {
    this.id = id;
  }
}

export class FindCameraByIdForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindCameraByIdQuery)
export class FindCameraByIdQueryHandler implements IQueryHandler<FindCameraByIdQuery> {
  constructor(
    @Inject(CAMERA_REPOSITORY)
    protected readonly cameraRepo: CameraRepository,
  ) {}

  async execute(query: FindCameraByIdQuery) {
    const record = await this.cameraRepo.findById(query.id);
    return record;
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
