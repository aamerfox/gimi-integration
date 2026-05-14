import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const FENCE_COLORS = [
    '#00d4aa', // teal (default)
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#ef4444', // red
    '#3b82f6', // blue
    '#ec4899', // pink
    '#10b981', // emerald
    '#f97316', // orange
];

export interface LocalGeofence {
    id: string;
    fenceName: string;
    description?: string;
    lat: number;
    lng: number;
    radius: number;          // in meters
    alarmType: 'in' | 'out' | 'in,out';
    color: string;
    enabled: boolean;
    imei?: string;           // optional — can apply to all devices
    deviceName?: string;
    createdAt: string;
    updatedAt?: string;
}

interface GeofenceState {
    geofences: LocalGeofence[];
    addGeofence: (g: Omit<LocalGeofence, 'id' | 'createdAt' | 'enabled' | 'color'> & { color?: string; enabled?: boolean }) => void;
    updateGeofence: (id: string, patch: Partial<Omit<LocalGeofence, 'id' | 'createdAt'>>) => void;
    removeGeofence: (id: string) => void;
    toggleGeofence: (id: string) => void;
    clearAll: () => void;
}

export const useGeofenceStore = create<GeofenceState>()(
    persist(
        (set) => ({
            geofences: [],
            addGeofence: (g) =>
                set((s) => ({
                    geofences: [
                        ...s.geofences,
                        {
                            ...g,
                            id: `gf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            color: g.color ?? FENCE_COLORS[s.geofences.length % FENCE_COLORS.length],
                            enabled: g.enabled ?? true,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                })),
            updateGeofence: (id, patch) =>
                set((s) => ({
                    geofences: s.geofences.map((g) =>
                        g.id === id ? { ...g, ...patch, updatedAt: new Date().toISOString() } : g
                    ),
                })),
            removeGeofence: (id) =>
                set((s) => ({ geofences: s.geofences.filter((g) => g.id !== id) })),
            toggleGeofence: (id) =>
                set((s) => ({
                    geofences: s.geofences.map((g) =>
                        g.id === id ? { ...g, enabled: !g.enabled, updatedAt: new Date().toISOString() } : g
                    ),
                })),
            clearAll: () => set({ geofences: [] }),
        }),
        { name: 'saudiex-geofences' }
    )
);
