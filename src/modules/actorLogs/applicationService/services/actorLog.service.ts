import { Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';
import { englishReportFields } from 'src/extensions/translation/languages/englishValues';
import { farsiReportFields } from 'src/extensions/translation/languages/farsiValues';
import { arabicReportFields } from 'src/extensions/translation/languages/arabicValues';
import { kurdiReportFields } from 'src/extensions/translation/languages/kurdiValues';
import { DictionarySections } from 'src/extensions/translation/translator.base';

@Injectable()
export class ActorLogsService {
  constructor(private readonly serviceProvider: ServiceProvider) {}

  async getDictionary() {
    const lang: LanguageCode =
      this.serviceProvider.userInfoService.getProps().lang;
    const dictionary =
      this.serviceProvider.translatorService.prepareDictionaryFormatForEachSection(
        lang,
        DictionarySections.ACTOR_LOG,
      );
    let otherKeys;
    if (lang === LanguageCode.FA) {
      otherKeys = farsiReportFields;
    } else if (lang === LanguageCode.EN) {
      otherKeys = englishReportFields;
    } else if (lang === LanguageCode.AR) {
      otherKeys = arabicReportFields;
    } else if (lang === LanguageCode.KU) {
      otherKeys = kurdiReportFields;
    } else {
      throw new Error('unSupported Language');
    }
    return { dictionary: { ...dictionary, ...otherKeys } };
  }
}
