import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { RolesGuardFactory } from 'src/modules/shared/roles.guard';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { NvrsHttpService } from '../applicationService/services/http/nvr.http.service';
import { AutoRegisterRequestDto } from '../contracts/nvr/http/request/autoRegister.request.dto';
import { HttpAccessTokenGuard } from 'src/utilities/auth/httpAccessToken.guard';

@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/video-devices/nvrs')
@UseGuards(
  HttpAccessTokenGuard,
  RolesGuardFactory(EmployeeRoles.Camera_RuleChain_Dashboard),
)
@Controller('/video-devices/nvrs')
export class NvrHttpController {
  constructor(private readonly nvrsHttpService: NvrsHttpService) {}

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
}
