import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhTranslation from '../locales/zh/common.json';
import enTranslation from '../locales/en/common.json';
import idTranslation from '../locales/id/common.json';

export const resources = {
  zh: {
    common: zhTranslation,
  },
  en: {
    common: enTranslation,
  },
  id: {
    common: idTranslation,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
