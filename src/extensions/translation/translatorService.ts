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
    const dictionary = this.getLanguageDictionaryByLang(lang);
    return this.filterDictionaryBySection(dictionary, section);
  }

  private getLanguageDictionaryByLang(
    lang: LanguageCode,
  ): Partial<LanguageKeysBase> {
    const dictionaryMap: Record<LanguageCode, LanguageKeysBase> = {
      [LanguageCode.FA]: farsiValues,
      [LanguageCode.EN]: englishValues,
      [LanguageCode.AR]: arabicValues,
      [LanguageCode.KU]: kurdiValues,
    };

    const dictionary = dictionaryMap[lang];

    if (!dictionary) {
      throw new BadRequestException(`Language code '${lang}' is not supported`);
    }

    return structuredClone(dictionary);
  }

  private filterDictionaryBySection(
    dictionary: Partial<LanguageKeysBase>,
    section: DictionarySections,
  ): Partial<LanguageKeysBase> {
    const filteredDictionary = { ...dictionary };

    for (const [key, value] of Object.entries(filteredDictionary) as Array<
      [keyof LanguageKeysBase, any]
    >) {
      const typedKey = key;

      if (this._shouldRemoveTopLevelKey(typedKey)) {
        delete filteredDictionary[typedKey];
        continue;
      }

      if (value) {
        this.filterInnerDictionary(value, section);

        if (Object.keys(value).length === 0) {
          delete filteredDictionary[typedKey];
        }
      }
    }
    return filteredDictionary;
  }

  private _shouldRemoveTopLevelKey(key: keyof LanguageKeysBase): boolean {
    return key === 'others';
  }

  private filterInnerDictionary(
    innerDict: Record<string, unknown>,
    section: DictionarySections,
  ): void {
    for (const innerKey of Object.keys(innerDict)) {
      if (innerKey === section) {
        continue;
      }

      const value = innerDict[innerKey];

      if (
        typeof value === 'object' &&
        value !== null &&
        section in (value as object)
      ) {
        // one level deeper (e.g. exposedApi.mqtt, exposedApi.rest)
        this.filterInnerDictionary(value as Record<string, unknown>, section);

        if (Object.keys(value as object).length === 0) {
          delete innerDict[innerKey];
        }
      } else {
        delete innerDict[innerKey];
      }
    }
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
    lang: LanguageCode = LanguageCode.FA,
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

const getObjectPropertyByStringKeyChain = (object: any, keychain: any) => {
  if (!keychain) return keychain;
  try {
    const result = keychain
      .split('.')
      .reduce((p: any, prop: any) => p?.[prop], object);
    return result ?? keychain;
  } catch (e) {
    return keychain;
  }
};
