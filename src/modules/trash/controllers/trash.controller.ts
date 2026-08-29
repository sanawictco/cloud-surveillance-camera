import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TrashService } from '../applicationService/services/trash.service';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { ActiveTenantGuard } from 'src/modules/tenantAccess/guards/activeTenant.guard';
import { EmployeeRolesGuard } from 'src/modules/tenantAccess/guards/employeeRoles.guard';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/trash')
@UseGuards(ActiveTenantGuard, EmployeeRolesGuard)
@Controller('/trash')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}
  @Get('/')
  find() {
    return this.trashService.find(UserInfoService.requireTenantId());
  }
}
