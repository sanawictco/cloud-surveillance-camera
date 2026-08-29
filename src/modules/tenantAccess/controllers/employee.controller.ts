import {
  Controller,
  Get,
  Put,
  Body,
  Delete,
  Post,
  Param,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FindEmployeeRequestDto } from '../contracts/employee/findEmployee.request.dto';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { OnlyIdParamRequestDto } from 'src/modules/shared/dtos/onlyIdParam.request.dto';
import { ActiveTenantGuard } from 'src/modules/tenantAccess/guards/activeTenant.guard';
import {
  RequireEmployeeRoles,
  EmployeeRolesGuard,
} from 'src/modules/tenantAccess/guards/employeeRoles.guard';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { EmployeeAccessHttpService } from 'src/modules/tenantAccess/applicationService/employeeAccess.http.service';
import { AddEmployeeRequestDto } from '../contracts/employee/addEmployee.request.dto';
import { UpdateEmployeeRolesRequestDto } from '../contracts/employee/updateEmployeeRoles.request.dto';
@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/employees')
@RequireEmployeeRoles(EmployeeRoles.Employee)
@UseGuards(ActiveTenantGuard, EmployeeRolesGuard)
@Controller('/employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeAccessHttpService) {}

  @Get('/')
  findAll() {
    return this.employeeService.findAll();
  }

  @Get('/find/:phoneNumber')
  findByPhoneNumber(@Param() param: FindEmployeeRequestDto) {
    return this.employeeService.findByPhoneNumber(param);
  }

  @Post('/')
  @HttpCode(HttpStatus.OK)
  add(@Body() body: AddEmployeeRequestDto) {
    return this.employeeService.add(body);
  }

  @Put('/:id')
  @HttpCode(HttpStatus.OK)
  updateRoles(
    @Param() params: OnlyIdParamRequestDto,
    @Body() body: UpdateEmployeeRolesRequestDto,
  ) {
    return this.employeeService.updateRoles(params.id, body);
  }

  @Delete('/:id/hard-delete')
  @HttpCode(HttpStatus.OK)
  hardDelete(@Param() params: OnlyIdParamRequestDto) {
    return this.employeeService.hardDelete(params.id);
  }

  @Delete('/:id/soft-delete')
  @HttpCode(HttpStatus.OK)
  softDelete(@Param() params: OnlyIdParamRequestDto) {
    return this.employeeService.softDelete(params.id);
  }

  @Put('/:id/recovery')
  @HttpCode(HttpStatus.OK)
  recovery(@Param() params: OnlyIdParamRequestDto) {
    return this.employeeService.recovery(params.id);
  }
}
