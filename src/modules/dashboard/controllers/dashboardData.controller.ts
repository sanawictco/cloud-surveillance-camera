import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { DashboardDataService } from '../applicationService/services/dashboardData.service';
import { SendDataRequestDto } from '../contracts/sendData.request.dto';
import { ActiveTenantGuard } from 'src/modules/tenantAccess/guards/activeTenant.guard';
import {
  RequireEmployeeRoles,
  EmployeeRolesGuard,
} from 'src/modules/tenantAccess/guards/employeeRoles.guard';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/dashboard/data')
@RequireEmployeeRoles(EmployeeRoles.Device_Dashboard)
@UseGuards(ActiveTenantGuard, EmployeeRolesGuard)
@Controller('/dashboard/data')
export class DashboardDataController {
  constructor(private readonly dashboardDataService: DashboardDataService) {}

  @Post('/send-move-data')
  @HttpCode(HttpStatus.ACCEPTED)
  sendMoveData(@Body() body: SendDataRequestDto): Promise<string> {
    return this.dashboardDataService.sendMoveData(body);
  }

  @Post('/send-zoom-data')
  @HttpCode(HttpStatus.ACCEPTED)
  sendZoomData(@Body() body: SendDataRequestDto): Promise<string> {
    return this.dashboardDataService.sendZoomData(body);
  }
}
