import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { QueryBase, QueryBaseParams } from 'src/dddLib/applicationService';
import { CAMERA_REPOSITORY } from 'src/modules/videoDevices/infra/camera/camera.diToken';
import { CameraRepository } from 'src/modules/videoDevices/infra/camera/camera.repository';
import { LiveSignalStatuses } from 'src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

// Full filter shape for a camera lookup; every query derives its own scope
// from this so the tenant clause can only come from the query, not a caller.
interface CameraQueryFilter {
  tenantId: string;
  name: string | RegExp;
  isActive: boolean;
  nvrId: string;
  liveSignalStatus: LiveSignalStatuses;
  isDeleted: boolean | { $ne: boolean };
}

// The tenant scope is supplied by the query itself, never by a caller filter.
type CameraTenantQueryFilter = Omit<CameraQueryFilter, 'tenantId'>;

export class FindAllCamerasForTenantQuery extends QueryBase<CameraTenantQueryFilter> {
  constructor(
    public readonly tenantId: string,
    props?: QueryBaseParams<CameraTenantQueryFilter>,
  ) {
    super(props);
    if (!tenantId) throw new Error('tenantId is required');
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
