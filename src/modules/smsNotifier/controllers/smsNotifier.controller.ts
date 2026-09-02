import {
  Body,
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateSmsNotifierRequestDto } from '../contracts/smsNotifier/updateSmsNotifier.request.dto';
import { CreateSmsNotifierRequestDto } from '../contracts/smsNotifier/createSmsNotifier.request.dto';
import { SmsNotifierService } from '../applicationService/services/smsNotifier.service';
import { OnlyIdParamRequestDto } from 'src/modules/shared/dtos/onlyIdParam.request.dto';
import { ActiveTenantGuard } from 'src/modules/tenantAccess/guards/activeTenant.guard';
import {
  RequireEmployeeRoles,
  EmployeeRolesGuard,
} from 'src/modules/tenantAccess/guards/employeeRoles.guard';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';

@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/employees/sms-notifiers')
@RequireEmployeeRoles(EmployeeRoles.Employee)
@UseGuards(ActiveTenantGuard, EmployeeRolesGuard)
@Controller('/employees/sms-notifiers')
export class SmsNotifierController {
  constructor(private readonly smsNotifierService: SmsNotifierService) {}

  @Get('/')
  find() {
    return this.smsNotifierService.find(UserInfoService.requireTenantId());
  }

  @Post('/')
  @HttpCode(HttpStatus.OK)
  create(@Body() body: CreateSmsNotifierRequestDto) {
    return this.smsNotifierService.create(body);
  }

  @Put('/:id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param() params: OnlyIdParamRequestDto,
    @Body() body: UpdateSmsNotifierRequestDto,
  ) {
    return this.smsNotifierService.update(params.id, body);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.OK)
  delete(@Param() params: OnlyIdParamRequestDto) {
    return this.smsNotifierService.delete(params.id);
  }
}
