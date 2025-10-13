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
import { ApiTags } from '@nestjs/swagger';
import { UpdateSmsNotifierRequestDto } from '../contracts/smsNotifier/updateSmsNotifier.request.dto';
import { CreateSmsNotifierRequestDto } from '../contracts/smsNotifier/createSmsNotifier.request.dto';
import { SmsNotifierService } from '../applicatoinService/services/smsNotifier.service';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { OnlyIdParamRequestDto } from 'src/modules/shared/dtos/onlyIdParam.request.dto';
import { RolesGuardFactory } from 'src/modules/shared/roles.guard';

@ApiTags('/employees/sms-notifiers')
@UseGuards(RolesGuardFactory(EmployeeRoles.Employee))
@Controller('/employees/sms-notifiers')
export class SmsNotifierController {
  constructor(private readonly smsNotifierService: SmsNotifierService) {}

  @Get('/')
  find() {
    return this.smsNotifierService.find();
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
