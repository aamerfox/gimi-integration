import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../i18n';

type Language = 'en' | 'ar';

interface LanguageState {
    language: Language;
    direction: 'ltr' | 'rtl';
    setLanguage: (lang: Language) => void;
    toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set, get) => ({
            language: 'en',
            direction: 'ltr',
            setLanguage: (lang) => {
                i18n.changeLanguage(lang);
                const direction = lang === 'ar' ? 'rtl' : 'ltr';
                document.documentElement.dir = direction;
                document.documentElement.lang = lang;
                set({ language: lang, direction });
            },
            toggleLanguage: () => {
                const currentLang = get().language;
                const newLang = currentLang === 'en' ? 'ar' : 'en';
                get().setLanguage(newLang);
            },
        }),
        {
            name: 'language-storage',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Ensure DOM is updated when state is rehydrated from localStorage
                    document.documentElement.dir = state.direction;
                    document.documentElement.lang = state.language;
                    i18n.changeLanguage(state.language);
                }
            },
        }
    )
);
