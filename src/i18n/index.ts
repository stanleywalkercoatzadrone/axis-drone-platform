import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en';
import es from './locales/es';
import pt from './locales/pt';
import fr from './locales/fr';
import de from './locales/de';
import ja from './locales/ja';
import zh from './locales/zh';
import ar from './locales/ar';
import hi from './locales/hi';
import ko from './locales/ko';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, es, pt, fr, de, ja, zh, ar, hi, ko },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'] },
  });

export default i18n;

/** Map pilot country ISO → locale code */
export const countryToLocale: Record<string, string> = {
  US: 'en', GB: 'en', CA: 'en', AU: 'en', NZ: 'en',
  MX: 'es', CO: 'es', AR: 'es', CL: 'es', PE: 'es', EC: 'es', VE: 'es', GT: 'es', CU: 'es',
  BR: 'pt', PT: 'pt',
  FR: 'fr', BE: 'fr', CH: 'fr', SN: 'fr', CI: 'fr',
  DE: 'de', AT: 'de',
  JP: 'ja',
  CN: 'zh', TW: 'zh', HK: 'zh', SG: 'zh',
  SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', JO: 'ar', IQ: 'ar',
  IN: 'hi',
  KR: 'ko',
};
