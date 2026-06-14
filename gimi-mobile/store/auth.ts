import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore adapter for Zustand persist — falls back to memory on web
const secureStorage = {
    getItem: async (key: string) => {
        if (Platform.OS === 'web') {
            return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
        }
        return SecureStore.getItemAsync(key);
    },
    setItem: async (key: string, value: string) => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
            return;
        }
        return SecureStore.setItemAsync(key, value);
    },
    removeItem: async (key: string) => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') window.localStorage.removeItem(key);
            return;
        }
        return SecureStore.deleteItemAsync(key);
    },
};

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    userId: string | null;
    expiresIn: number | null;
    appKey: string | null;
    setAuth: (data: {
        accessToken: string;
        refreshToken: string;
        userId: string;
        expiresIn: number;
        appKey: string;
    }) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            userId: null,
            expiresIn: null,
            appKey: null,
            setAuth: (data) => set(data),
            logout: () =>
                set({
                    accessToken: null,
                    refreshToken: null,
                    userId: null,
                    expiresIn: null,
                    appKey: null,
                }),
        }),
        {
            name: 'traceplus-auth',
            storage: createJSONStorage(() => secureStorage),
        }
    )
);
