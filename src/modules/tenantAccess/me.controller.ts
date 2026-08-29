import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { TenantAccessService } from './applicationService/tenantAccess.service';
import { MyTenantResponseDto } from './contracts/myTenant.response.dto';

@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/me')
@Controller('/me')
export class MeController {
  constructor(private readonly tenantAccessService: TenantAccessService) {}

  @Get('/tenants')
  findMyTenants(): Promise<MyTenantResponseDto[]> {
    const user = UserInfoService.getProps();
    if (!user) throw new UnauthorizedException();
    return this.tenantAccessService.findMyTenants(user.id);
  }
}
