import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { RequireAtLeastOneFieldPipe } from 'src/shared/requireAtLeastOneField.pipe';
import { CameraResponseDto } from '../contracts/camera/http/camera.response.dto';
import { OnlyIdParamRequestDto } from 'src/modules/shared/dtos/onlyIdParam.request.dto';
import { UpdateCameraRequestDto } from '../contracts/camera/http/updateCamera.request.dto';
import { CameraIdsRequestDto } from '../contracts/camera/http/cameras.request.dto';
import { CamerasHttpService } from '../applicationService/services/http/camera.http.service';
import { ActiveTenantGuard } from 'src/modules/tenantAccess/guards/activeTenant.guard';
import {
  RequireEmployeeRoles,
  EmployeeRolesGuard,
} from 'src/modules/tenantAccess/guards/employeeRoles.guard';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/video-devices/cameras')
@ApiHeader({ name: 'X-Tenant-Id', required: true })
@RequireEmployeeRoles(EmployeeRoles.Device_Dashboard)
@UseGuards(ActiveTenantGuard, EmployeeRolesGuard)
@Controller('/video-devices/cameras')
export class CamerasHttpController {
  constructor(private readonly cameraService: CamerasHttpService) {}
  @Get('/')
  find(): Promise<CameraResponseDto[]> {
    return this.cameraService.find();
  }

  @Get('/:id')
  findOne(@Param() params: OnlyIdParamRequestDto): Promise<CameraResponseDto> {
    return this.cameraService.findOne(params.id);
  }

  @Put('/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  update(
    @Param() params: OnlyIdParamRequestDto,
    @Body(RequireAtLeastOneFieldPipe) body: UpdateCameraRequestDto,
  ): Promise<string> {
    return this.cameraService.update(params.id, body);
  }

  @Delete('/multi-hard-delete')
  @HttpCode(HttpStatus.OK)
  hardDeleteCameras(@Query() query: CameraIdsRequestDto) {
    return this.cameraService.hardDeleteCameras(query.cameraIds);
  }
}
