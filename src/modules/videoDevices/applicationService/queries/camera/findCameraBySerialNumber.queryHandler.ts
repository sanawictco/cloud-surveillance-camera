import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { Inject } from '@nestjs/common';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';
import { buildTenantFilter } from 'src/modules/shared/tenantFilter';

export class FindCameraBySerialNumberQuery {
  constructor(
    public readonly serialNumber: string,
    public readonly nvrId: string,
  ) {
    this.serialNumber = serialNumber;
    this.nvrId = nvrId;
  }
}

export class FindCameraBySerialNumberForTenantQuery {
  constructor(
    public readonly tenantId: string,
    public readonly serialNumber: string,
    public readonly nvrId: string,
  ) {
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindCameraBySerialNumberQuery)
export class FindCameraBySerialNumberQueryHandler
  implements IQueryHandler<FindCameraBySerialNumberQuery>
{
  constructor(
    @Inject(CAMERA_REPOSITORY)
    protected readonly cameraRepo: CameraRepository,
  ) {}

  async execute(query: FindCameraBySerialNumberQuery) {
    const record = await this.cameraRepo.findOne({
      serialNumber: query.serialNumber,
      nvrId: query.nvrId,
    });
    return record;
  }
}

@QueryHandler(FindCameraBySerialNumberForTenantQuery)
export class FindCameraBySerialNumberForTenantQueryHandler
  implements IQueryHandler<FindCameraBySerialNumberForTenantQuery>
{
  constructor(
    @Inject(CAMERA_REPOSITORY)
    private readonly cameraRepo: CameraRepository,
  ) {}

  execute(query: FindCameraBySerialNumberForTenantQuery) {
    return this.cameraRepo.findOne(
      buildTenantFilter(query.tenantId, {
        serialNumber: query.serialNumber,
        nvrId: query.nvrId,
      }),
    );
  }
}
