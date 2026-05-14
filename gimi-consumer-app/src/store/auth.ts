import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    accessToken: string | null;
    expiresIn: number | null;
    refreshToken: string | null;
    userId: string | null; // The account name
    appKey: string | null;
    isAuthenticated: boolean;

    // Actions
    setAuth: (data: { accessToken: string; expiresIn: number; refreshToken: string; userId: string; appKey: string }) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            expiresIn: null,
            refreshToken: null,
            userId: null,
            appKey: null,
            isAuthenticated: false,

            setAuth: (data) => set({
                accessToken: data.accessToken,
                expiresIn: data.expiresIn,
                refreshToken: data.refreshToken,
                userId: data.userId,
                appKey: data.appKey,
                isAuthenticated: true,
            }),

            logout: () => set({
                accessToken: null,
                expiresIn: null,
                refreshToken: null,
                userId: null,
                appKey: null,
                isAuthenticated: false,
            }),
        }),
        {
            name: 'gimi-auth-storage',
        }
    )
);
