import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';

export type LanguageCode = 'en' | 'ar';

interface LanguageState {
    language: LanguageCode;
    direction: 'ltr' | 'rtl';
    setLanguage: (lang: LanguageCode) => Promise<void>;
}

const storage = createJSONStorage(() => {
    if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') return window.localStorage;
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} } as any;
    }
    return AsyncStorage;
});

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set, get) => ({
            language: 'en',
            direction: 'ltr',
            setLanguage: async (lang: LanguageCode) => {
                if (get().language === lang) return;

                const isRTL = lang === 'ar';
                set({ language: lang, direction: isRTL ? 'rtl' : 'ltr' });

                // Allow RTL formatting on Android/iOS
                if (Platform.OS !== 'web') {
                    I18nManager.allowRTL(isRTL);
                    I18nManager.forceRTL(isRTL);
                } else {
                    // Update document direction immediately on web
                    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
                    document.documentElement.lang = lang;
                }
            },
        }),
        {
            name: 'traceplus-mobile-language',
            storage
        }
    )
);
