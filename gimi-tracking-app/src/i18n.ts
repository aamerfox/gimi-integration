import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import arTranslation from './locales/ar.json';

const resources = {
    en: {
        translation: enTranslation,
    },
    ar: {
        translation: arTranslation,
    },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: localStorage.getItem('language-storage')
            ? JSON.parse(localStorage.getItem('language-storage') as string)?.state?.language || 'en'
            : 'en',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
    });

export default i18n;
