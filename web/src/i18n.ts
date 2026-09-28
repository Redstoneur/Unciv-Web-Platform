import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

/**
 * French is the default language. To add a language: create `locales/<code>.json`,
 * register it below and add it to SUPPORTED_LOCALES in api/src/lib/locales.ts.
 */
export const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

export type Locale = keyof typeof resources;
export const DEFAULT_LOCALE: Locale = 'fr';
export const SUPPORTED_LOCALES = Object.keys(resources) as Locale[];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      // The explicit choice wins, the browser language is only a hint on first visit.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'unciv-web-platform.locale',
    },
  });

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});

export default i18n;
