import { LanguageCode } from '../translation/languageCode.enum';

export type WsClientCachedModel = {
  id: string;
  tenantId: string;
  phoneNumber: string;
  name: string;
  roles: string[];
  lang: LanguageCode;
};
