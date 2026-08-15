import { DashboardPageProjection } from 'src/dddLib/contracts/dashboardPage.projection';
import { CameraResponseDto } from '../../../camera/http/camera.response.dto';

export interface GetNvrDependenciesResposeDto {
  cameras: CameraResponseDto[];
  pages: DashboardPageProjection[];
}
