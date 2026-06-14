import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ar from './ar.json';
import { useLanguageStore } from '../store/language';

const resources = {
    en: { translation: en },
    ar: { translation: ar },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en', // Default until hydration
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        compatibilityJSON: 'v4',
    });

// Sync the initial state if already hydrated
const initialState = useLanguageStore.getState();
if (initialState.language && i18n.language !== initialState.language) {
    i18n.changeLanguage(initialState.language);
}

// Listen to Zustand store changes to update i18n language dynamically
useLanguageStore.subscribe((state) => {
    if (i18n.language !== state.language) {
        i18n.changeLanguage(state.language);
    }
});

export default i18n;
