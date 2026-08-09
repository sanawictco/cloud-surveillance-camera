import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { RolesGuardFactory } from 'src/modules/shared/roles.guard';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { DashboardDataService } from '../applicationService/services/dashboardData.service';
import { SendDataRequestDto } from '../contracts/sendData.request.dto';
@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/dashboard/data')
@UseGuards(RolesGuardFactory(EmployeeRoles.Device_RuleChain_Dashboard))
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
