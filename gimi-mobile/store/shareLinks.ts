import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface ShareLink {
    id: string;
    imei: string;
    deviceName: string;
    url: string;
    exp: number;       // unix timestamp (seconds)
    createdAt: string; // ISO
}

interface ShareLinkState {
    links: ShareLink[];
    addLink: (link: ShareLink) => void;
    removeLink: (id: string) => void;
    clearExpired: () => void;
}

const storage = Platform.OS === 'web'
    ? createJSONStorage(() => localStorage)
    : createJSONStorage(() => AsyncStorage);

export const useShareLinkStore = create<ShareLinkState>()(
    persist(
        (set) => ({
            links: [],
            addLink: (link) =>
                set((s) => ({ links: [link, ...s.links].slice(0, 50) })), // keep last 50
            removeLink: (id) =>
                set((s) => ({ links: s.links.filter((l) => l.id !== id) })),
            clearExpired: () =>
                set((s) => ({
                    links: s.links.filter((l) => l.exp > Date.now() / 1000),
                })),
        }),
        { name: 'traceplus-share-links', storage }
    )
);
