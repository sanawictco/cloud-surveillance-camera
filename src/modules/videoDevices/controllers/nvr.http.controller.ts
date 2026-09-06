import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { NvrsHttpService } from '../applicationService/services/http/nvr.http.service';
import { AutoRegisterRequestDto } from '../contracts/nvr/http/request/autoRegister.request.dto';
import { OnlyIdParamRequestDto } from 'src/modules/shared/dtos/onlyIdParam.request.dto';
import { GetNvrDependenciesResposeDto } from '../contracts/nvr/http/response/getNvrDependencies.response.dto';
import { CreateNvrRequestDto } from '../contracts/nvr/http/request/createNvr.request.dto';
import { UpdateNvrRequestDto } from '../contracts/nvr/http/request/updateNvr.request.dto';
import { NvrResponseDto } from '../contracts/nvr/http/response/nvr.response.dto';
import { RequireAtLeastOneFieldPipe } from 'src/shared/requireAtLeastOneField.pipe';
import { ActiveTenantGuard } from 'src/modules/tenantAccess/guards/activeTenant.guard';
import {
  RequireEmployeeRoles,
  EmployeeRolesGuard,
} from 'src/modules/tenantAccess/guards/employeeRoles.guard';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { CameraIdsRequestDto } from '../contracts/camera/http/cameras.request.dto';

@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/video-devices/nvrs')
@RequireEmployeeRoles(EmployeeRoles.Device_Dashboard)
@UseGuards(ActiveTenantGuard, EmployeeRolesGuard)
@Controller('/video-devices/nvrs')
export class NvrHttpController {
  constructor(private readonly nvrsHttpService: NvrsHttpService) {}

  @Get('/')
  find(): Promise<NvrResponseDto[]> {
    return this.nvrsHttpService.find();
  }

  @Get('/:id')
  findOne(@Param() params: OnlyIdParamRequestDto): Promise<NvrResponseDto> {
    return this.nvrsHttpService.findOne(params.id);
  }

  @Get('/:id/dependencies')
  getDependencies(
    @Param() params: OnlyIdParamRequestDto,
  ): Promise<GetNvrDependenciesResposeDto> {
    return this.nvrsHttpService.getDependencies(params.id);
  }

  @Post('/')
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() body: CreateNvrRequestDto): Promise<string> {
    return this.nvrsHttpService.create(body);
  }

  @Put('/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  update(
    @Param() params: OnlyIdParamRequestDto,
    @Body(RequireAtLeastOneFieldPipe) body: UpdateNvrRequestDto,
  ): Promise<string> {
    return this.nvrsHttpService.update(params.id, body);
  }

  @Patch('/:id/active')
  @HttpCode(HttpStatus.ACCEPTED)
  active(@Param() params: OnlyIdParamRequestDto): Promise<string> {
    return this.nvrsHttpService.active(params.id);
  }

  @Patch('/:id/inactive')
  @HttpCode(HttpStatus.ACCEPTED)
  inactive(@Param() params: OnlyIdParamRequestDto): Promise<string> {
    return this.nvrsHttpService.inactive(params.id);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  delete(@Param() params: OnlyIdParamRequestDto): Promise<string> {
    return this.nvrsHttpService.delete(params.id);
  }

  @Get('/:id/auto-search')
  @HttpCode(HttpStatus.ACCEPTED)
  autoSearch(@Param('id') id: string): Promise<string> {
    return this.nvrsHttpService.autoSearch(id);
  }

  @Post('/auto-register')
  @HttpCode(HttpStatus.ACCEPTED)
  autoRegister(@Body() body: AutoRegisterRequestDto): Promise<string> {
    return this.nvrsHttpService.autoRegister(body);
  }

  @Patch('/:id/cameras/active')
  @HttpCode(HttpStatus.ACCEPTED)
  activeateEndDevices(
    @Param() params: OnlyIdParamRequestDto,
    @Body() body: CameraIdsRequestDto,
  ): Promise<string> {
    return this.nvrsHttpService.activateCameras(params.id, body.cameraIds);
  }

  @Patch('/:id/cameras/inactive')
  @HttpCode(HttpStatus.ACCEPTED)
  inactivateCameras(
    @Param() params: OnlyIdParamRequestDto,
    @Body() body: CameraIdsRequestDto,
  ): Promise<string> {
    return this.nvrsHttpService.inactivateCameras(params.id, body.cameraIds);
  }

  @Delete('/:id/cameras/soft-delete')
  @HttpCode(HttpStatus.ACCEPTED)
  softDeleteCameras(
    @Param() params: OnlyIdParamRequestDto,
    @Query() query: CameraIdsRequestDto,
  ): Promise<string> {
    return this.nvrsHttpService.softDeleteCameras(params.id, query.cameraIds);
  }
}
