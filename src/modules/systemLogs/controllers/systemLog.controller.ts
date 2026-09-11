import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { ActiveTenantGuard } from 'src/modules/tenantAccess/guards/activeTenant.guard';
import { SystemLogService } from '../applicationService/services/systemLog.service';
import { GetAllSystemLogsRequestDto } from '../contracts/systemLog/getAllSystemLogs.request.dto';

@ApiTags('/system-logs')
@Controller('/system-logs')
export class SystemLogController {
  constructor(private readonly systemLogService: SystemLogService) {}

  @Get('/')
  @ApiHeader({ name: 'X-Tenant-Id', required: true })
  @UseGuards(ActiveTenantGuard)
  findAll(@Query() query: GetAllSystemLogsRequestDto) {
    return this.systemLogService.findAll(query);
  }

  @Get('/dictionary')
  getDictionary() {
    return this.systemLogService.getDictionary();
  }
}
