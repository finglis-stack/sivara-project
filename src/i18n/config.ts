import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Cookies from 'js-cookie';

import en from './locales/en.json';
import fr from './locales/fr.json';

const resources = {
  'en-CA': { translation: en },
  'fr-CA': { translation: fr },
};

const savedLang = Cookies.get('sivara-lang');
const browserLang = navigator.language.startsWith('fr') ? 'fr-CA' : 'en-CA';
const defaultLang = ['fr-CA', 'en-CA'].includes(savedLang || '') ? savedLang : browserLang;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLang,
    fallbackLng: 'en-CA',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
