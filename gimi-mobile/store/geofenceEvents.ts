import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface GeofenceEvent {
    fenceId: string;
    fenceName: string;
    deviceName: string;
    imei: string;
    type: 'enter' | 'exit';
    timestamp: string; // ISO
    lat?: number;
    lng?: number;
}

interface GeofenceEventState {
    events: GeofenceEvent[];
    unreadCount: number;
    addEvent: (e: GeofenceEvent) => void;
    markAllRead: () => void;
    clearEvents: () => void;
}

const storage = Platform.OS === 'web'
    ? createJSONStorage(() => localStorage)
    : createJSONStorage(() => AsyncStorage);

export const useGeofenceEventStore = create<GeofenceEventState>()(
    persist(
        (set) => ({
            events: [],
            unreadCount: 0,
            addEvent: (e) =>
                set((s) => ({
                    events: [e, ...s.events].slice(0, 200), // keep last 200
                    unreadCount: s.unreadCount + 1,
                })),
            markAllRead: () => set({ unreadCount: 0 }),
            clearEvents: () => set({ events: [], unreadCount: 0 }),
        }),
        { name: 'traceplus-geofence-events', storage }
    )
);
