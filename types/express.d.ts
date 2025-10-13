import { UserInfoDto } from 'src/extensions/userInfo/userInfo.dto';

export {};
declare global {
  namespace Express {
    export interface Request {
      user?: UserInfoDto;
    }
  }
}
