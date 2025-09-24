import { UserInfoDto } from './userInfo.dto';
import { Injectable } from '@nestjs/common';
import { RequestContextService } from 'src/dddLib/utils/appRequestContext';

@Injectable()
export class UserInfoService {
  static getProps(): UserInfoDto {
    const ctx: any = RequestContextService.getContext();
    return ctx?.user;
  }
  getProps(): UserInfoDto {
    const ctx: any = RequestContextService.getContext();
    return ctx?.user;
  }
}
