import { LanguageCode } from '../translation/languageCode.enum';

export type WsClientCachedModel = {
  id: string;
  phoneNumber: string;
  name: string;
  roles: string;
  lang: LanguageCode;
};
