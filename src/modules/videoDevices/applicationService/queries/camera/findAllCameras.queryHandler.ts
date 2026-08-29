import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { QueryBase, QueryBaseParams } from 'src/dddLib/applicationService';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

interface CameraQueryFilter {
  tenantId: string;
  name: string | RegExp;
  isActive: boolean;
  nvrId: string;
  liveSignalStatus: LiveSignalStatuses;
  isDeleted: boolean | { $ne: boolean };
}

interface CameraTenantQueryFilter {
  name: string | RegExp;
  isActive: boolean;
  nvrId: string;
  liveSignalStatus: LiveSignalStatuses;
  isDeleted: boolean | { $ne: boolean };
}

export class FindAllCamerasQuery extends QueryBase<CameraQueryFilter> {}

export class FindAllCamerasForTenantQuery extends QueryBase<CameraTenantQueryFilter> {
  constructor(
    public readonly tenantId: string,
    props?: QueryBaseParams<CameraTenantQueryFilter>,
  ) {
    super(props);
    if (!tenantId) throw new Error('tenantId is required');
  }
}
@QueryHandler(FindAllCamerasQuery)
export class FindAllCamerasQueryHandler implements IQueryHandler<FindAllCamerasQuery> {
  constructor(
    @Inject(CAMERA_REPOSITORY)
    protected readonly cameraRepo: CameraRepository,
  ) {}

  async execute(query: FindAllCamerasQuery) {
    const records = await this.cameraRepo.findAll(query);
    return records;
  }
}

@QueryHandler(FindAllCamerasForTenantQuery)
export class FindAllCamerasForTenantQueryHandler implements IQueryHandler<FindAllCamerasForTenantQuery> {
  constructor(
    @Inject(CAMERA_REPOSITORY)
    private readonly cameraRepo: CameraRepository,
  ) {}

  execute(query: FindAllCamerasForTenantQuery) {
    return this.cameraRepo.findAll({
      filter: { $and: [{ tenantId: query.tenantId }, query.filter ?? {}] },
      orderBy: query.orderBy,
    });
  }
}
