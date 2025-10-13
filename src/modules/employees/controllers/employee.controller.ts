import {
  Controller,
  Get,
  Put,
  Body,
  Delete,
  Post,
  Param,
  Req,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateEmployeeRolesRequestDto } from '../contracts/employee/updateEmployeeRoles.request.dto';
import { FindEmployeeRequestDto } from '../contracts/employee/findEmployee.request.dto';
import { AddEmployeeRequestDto } from '../contracts/employee/addEmployee.request.dto';
import { EmployeeService } from '../applicatoinService/services/employee.service';
import express from 'express';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { RolesGuardFactory } from 'src/modules/shared/roles.guard';
import { OnlyIdParamRequestDto } from 'src/modules/shared/dtos/onlyIdParam.request.dto';
@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/employees')
@UseGuards(RolesGuardFactory(EmployeeRoles.Employee))
@Controller('/employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

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
    @Req() req: express.Request,
  ) {
    return this.employeeService.updateRoles(params.id, body, req);
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
  recovery(
    @Param() params: OnlyIdParamRequestDto,
    @Req() req: express.Request,
  ) {
    return this.employeeService.recovery(params.id, req);
  }
}
