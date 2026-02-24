import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GeofenceEvent {
    id: string;
    fenceId: string;
    fenceName: string;
    deviceName: string;
    imei: string;
    eventType: 'entered' | 'exited';
    lat: number;
    lng: number;
    timestamp: string; // ISO string
    read: boolean;
}

interface GeofenceEventState {
    events: GeofenceEvent[];
    addEvent: (e: Omit<GeofenceEvent, 'id' | 'read'>) => void;
    markAllRead: () => void;
    clearEvents: () => void;
    unreadCount: () => number;
}

export const useGeofenceEventStore = create<GeofenceEventState>()(
    persist(
        (set, get) => ({
            events: [],

            addEvent: (e) =>
                set((s) => ({
                    events: [
                        {
                            ...e,
                            id: `gfe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            read: false,
                        },
                        ...s.events,
                    ].slice(0, 500), // keep latest 500
                })),

            markAllRead: () =>
                set((s) => ({
                    events: s.events.map((e) => ({ ...e, read: true })),
                })),

            clearEvents: () => set({ events: [] }),

            unreadCount: () => get().events.filter((e) => !e.read).length,
        }),
        { name: 'saudiex-geofence-events' }
    )
);
