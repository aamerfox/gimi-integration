import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'default' | 'oasis' | 'sunset' | 'forest' | 'engineer';
export type Lang = 'ar' | 'en';

interface AppStore {
  theme: Theme;
  lang: Lang;
  notificationsEnabled: boolean;
  darkMode: boolean;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  setNotifications: (v: boolean) => void;
  setDarkMode: (v: boolean) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      theme: 'default',
      lang: 'ar',
      notificationsEnabled: true,
      darkMode: false,
      setTheme: (theme) => set({ theme }),
      setLang: (lang) => set({ lang }),
      setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
      setDarkMode: (darkMode) => set({ darkMode }),
    }),
    { name: 'gimi-consumer-app' }
  )
);
