import { BadRequestException, Injectable } from '@nestjs/common';
import { StringExtensions } from 'src/dddLib/utils/stringExtensions';
import { LanguageCode } from './languageCode.enum';
import { LanguageKeysBase } from './languageKeys.base';
import { arabicValues } from './languages/arabicValues';
import { englishValues } from './languages/englishValues';
import { farsiValues } from './languages/farsiValues';
import { kurdiValues } from './languages/kurdiValues';
import { DictionarySections, TranslatorBase } from './translator.base';

@Injectable()
export class TranslatorService implements TranslatorBase {
  constructor() {}

  prepareDictionaryFormatForEachSection(
    lang: LanguageCode,
    section: DictionarySections,
  ): Partial<LanguageKeysBase> {
    let dictionary: Partial<LanguageKeysBase>;
    if (lang === LanguageCode.FA) {
      dictionary = structuredClone(farsiValues);
    } else if (lang === LanguageCode.EN) {
      dictionary = structuredClone(englishValues);
    } else if (lang === LanguageCode.AR) {
      dictionary = structuredClone(arabicValues);
    } else if (lang === LanguageCode.KU) {
      dictionary = structuredClone(kurdiValues);
    } else {
      throw new BadRequestException('not supported');
    }

    for (const key of Object.keys(dictionary) as (keyof LanguageKeysBase)[]) {
      const dictionarySection = dictionary[key];
      if (!dictionarySection) continue;
      const sectionValues = dictionarySection as Record<string, unknown>;
      for (const innerKey in sectionValues) {
        if (innerKey !== section) delete sectionValues[innerKey];
      }
      if (Object.keys(dictionarySection).length === 0) delete dictionary[key];
    }
    // delete dictionary.exposedApi;
    // delete dictionary.others;
    return dictionary;
  }

  translateByName(
    keychain: string,
    lang: LanguageCode = LanguageCode.FA,
  ): string {
    switch (lang) {
      case LanguageCode.EN:
        return getObjectPropertyByStringKeyChain(englishValues, keychain);
      case LanguageCode.FA:
        return getObjectPropertyByStringKeyChain(farsiValues, keychain);
      case LanguageCode.AR:
        return getObjectPropertyByStringKeyChain(arabicValues, keychain);
      case LanguageCode.KU:
        return getObjectPropertyByStringKeyChain(kurdiValues, keychain);
      default:
        return 'not supported language';
    }
  }

  translateByPattern(
    keychain: string,
    params: unknown[],
    lang: LanguageCode = LanguageCode.EN,
  ): string {
    switch (lang) {
      case LanguageCode.EN:
        return StringExtensions.formatWithParams(
          getObjectPropertyByStringKeyChain(englishValues, keychain),
          params,
        );
      case LanguageCode.FA:
        return StringExtensions.formatWithParams(
          getObjectPropertyByStringKeyChain(farsiValues, keychain),
          params,
        );
      case LanguageCode.AR:
        return StringExtensions.formatWithParams(
          getObjectPropertyByStringKeyChain(arabicValues, keychain),
          params,
        );
      case LanguageCode.KU:
        return StringExtensions.formatWithParams(
          getObjectPropertyByStringKeyChain(kurdiValues, keychain),
          params,
        );
      default:
        return 'not supported language';
    }
  }
}

const getObjectPropertyByStringKeyChain = (
  object: object,
  keychain: string,
): string => {
  if (!keychain) return '';
  try {
    const value = keychain.split('.').reduce<unknown>((current, property) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[property];
    }, object);
    return typeof value === 'string' ? value : '';
  } catch (e) {
    console.log('>>>>>>>>', keychain, e);
    return '';
  }
};
