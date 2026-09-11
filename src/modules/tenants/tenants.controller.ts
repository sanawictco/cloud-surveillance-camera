import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { TenantAccessService } from 'src/modules/tenantAccess/applicationService/tenantAccess.service';
import { MyTenantResponseDto } from 'src/modules/tenantAccess/contracts/myTenant.response.dto';
import { TenantsService } from './applicationService/services/tenants.service';
import { CreateTenantRequestDto } from './contracts/createTenant.request.dto';
import { TenantResponseDto } from './contracts/tenant.response.dto';

@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/tenants')
@Controller('/tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantAccessService: TenantAccessService,
  ) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateTenantRequestDto): Promise<TenantResponseDto> {
    const user = UserInfoService.getProps();
    if (!user) throw new UnauthorizedException();
    return this.tenantsService.create(user.id, body);
  }

  @Get('/')
  findMyTenants(): Promise<MyTenantResponseDto[]> {
    const user = UserInfoService.getProps();
    if (!user) throw new UnauthorizedException();
    return this.tenantAccessService.findMyTenants(user.id);
  }
}
