import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';

export class FindCameraByNameQuery {
  constructor(public readonly name: string) {
    this.name = name;
  }
}

export class FindCameraByNameForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly name: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindCameraByNameQuery)
export class FindCameraByNameQueryHandler implements IQueryHandler<FindCameraByNameQuery> {
  constructor(
    @Inject(CAMERA_REPOSITORY)
    protected readonly cameraRepo: CameraRepository,
  ) {}

  async execute(query: FindCameraByNameQuery) {
    const record = await this.cameraRepo.findOne({ name: query.name });
    return record;
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
