import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { gimiService } from '../services/gimi';
import { useAuthStore } from './auth';
import { useDeviceStore } from './devices';
import type { Device } from './devices';

interface ApiGeofence {
    fenceId?: string | number;
    fenceSerialNo?: string | number;
    id?: string | number;
    alarmType?: string;
    alarm_type?: string;
    radius?: string | number;
    imei?: string;
    fenceName?: string;
    name?: string;
    description?: string;
    lat?: string | number;
    centerLat?: string | number;
    lng?: string | number;
    centerLng?: string | number;
    alarmSwitch?: string;
    alarm_switch?: string;
    deviceName?: string;
}

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
    isLocal?: boolean;
}

interface GeofenceState {
    geofences: LocalGeofence[];
    apiGeofences: LocalGeofence[];
    isLoadingApi: boolean;
    apiError: string | null;
    addGeofence: (g: Omit<LocalGeofence, 'id' | 'createdAt' | 'enabled' | 'color'> & { color?: string; enabled?: boolean }) => void;
    updateGeofence: (id: string, patch: Partial<Omit<LocalGeofence, 'id' | 'createdAt'>>) => void;
    removeGeofence: (id: string) => void;
    toggleGeofence: (id: string) => void;
    clearAll: () => void;
    fetchApiGeofences: () => Promise<void>;
}

export const useGeofenceStore = create<GeofenceState>()(
    persist(
        (set) => ({
            geofences: [],
            apiGeofences: [],
            isLoadingApi: false,
            apiError: null,

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

            fetchApiGeofences: async () => {
                const { accessToken, userId: account } = useAuthStore.getState();
                if (!accessToken || !account) return;

                set({ isLoadingApi: true, apiError: null });
                try {
                    // 1. Fetch platform geofences (defensive: result may be array or object with nested array)
                    let platformFences: any[] = [];
                    try {
                        const platformRes = await gimiService.getGeofences(accessToken, account) as any;
                        const raw = platformRes?.result || platformRes?.data || [];
                        platformFences = Array.isArray(raw) ? raw : (raw?.fenceList || raw?.list || []);
                    } catch (platformErr) {
                        console.warn('[Geofences] Platform fence fetch failed:', platformErr);
                    }

                    // 2. Fetch device geofences for each device
                    const devices = useDeviceStore.getState().devices || [];
                    let deviceFences: any[] = [];
                    if (Array.isArray(devices) && devices.length > 0) {
                        const deviceFencesPromises = devices.map(async (device) => {
                            try {
                                const res = await gimiService.getDeviceFences(accessToken, device.imei) as any;
                                const raw = res?.result || res?.data || [];
                                const list = Array.isArray(raw) ? raw : (raw?.fenceList || raw?.list || []);
                                return list.map((f: any) => ({
                                    ...f,
                                    imei: device.imei,
                                    deviceName: device.deviceName
                                }));
                            } catch (err) {
                                console.warn(`[Geofences] Device fence fetch failed for ${device.imei}:`, err);
                                return [];
                            }
                        });

                        const deviceFencesArrays = await Promise.all(deviceFencesPromises);
                        deviceFences = deviceFencesArrays.flat();
                    }

                    // 3. Combine both lists
                    const rawList = [...platformFences, ...deviceFences];
                    
                    const normalized: LocalGeofence[] = rawList.map((f: ApiGeofence, idx: number) => {
                        const fenceId = f.fenceId || f.fenceSerialNo || f.id || `api-${idx}-${Date.now()}`;
                        
                        let alarmType: 'in' | 'out' | 'in,out' = 'in,out';
                        const apiAlarmType = (f.alarmType || f.alarm_type || '').toLowerCase();
                        if (apiAlarmType === 'in') alarmType = 'in';
                        else if (apiAlarmType === 'out') alarmType = 'out';
                        else if (apiAlarmType === 'in_out' || apiAlarmType === 'in,out') alarmType = 'in,out';

                        const radius = (Number(f.radius) * 100) || 500;
                        const imei = f.imei || undefined;
                        const device = devices.find((d: Device) => d.imei === imei);

                        return {
                            id: String(fenceId),
                            fenceName: f.fenceName || f.name || 'Unnamed',
                            description: f.description || 'TrackSolid Geofence',
                            lat: Number(f.lat || f.centerLat || 0),
                            lng: Number(f.lng || f.centerLng || 0),
                            radius: radius,
                            alarmType: alarmType,
                            color: FENCE_COLORS[idx % FENCE_COLORS.length],
                            enabled: f.alarmSwitch !== 'OFF' && f.alarm_switch !== 'OFF',
                            imei: imei,
                            deviceName: device?.deviceName || f.deviceName,
                            createdAt: new Date().toISOString(),
                            isLocal: false,
                        };
                    });
                    
                    set({ apiGeofences: normalized, isLoadingApi: false });
                } catch (err: unknown) {
                    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch API geofences';
                    set({ apiError: errorMsg, isLoadingApi: false });
                }
            },
        }),
        {
            name: 'saudiex-geofences',
            partialize: (state) => ({ geofences: state.geofences }),
        }
    )
);
