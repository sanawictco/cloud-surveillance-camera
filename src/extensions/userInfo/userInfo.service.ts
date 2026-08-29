import { UserInfoDto } from './userInfo.dto';
import { Injectable } from '@nestjs/common';
import { RequestContextService } from 'src/dddLib/utils/appRequestContext';

@Injectable()
export class UserInfoService {
  static getProps(): UserInfoDto {
    const ctx = RequestContextService.getContext();
    return ctx?.user as UserInfoDto;
  }
  getProps(): UserInfoDto {
    const ctx = RequestContextService.getContext();
    return ctx?.user as UserInfoDto;
  }

  static requireTenantId(): string {
    return RequestContextService.requireTenantId();
  }

  requireTenantId(): string {
    return RequestContextService.requireTenantId();
  }
}
