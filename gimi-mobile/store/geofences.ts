import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { gimiService } from '@/services/gimi';
import { useAuthStore } from './auth';
import { useDeviceStore } from './devices';

export const FENCE_COLORS = [
    '#00d4aa',
    '#8b5cf6',
    '#f59e0b',
    '#ef4444',
    '#3b82f6',
    '#ec4899',
    '#10b981',
    '#f97316',
];

export interface LocalGeofence {
    id: string;
    fenceName: string;
    description?: string;
    lat: number;
    lng: number;
    radius: number;
    alarmType: 'in' | 'out' | 'in,out';
    color?: string;
    enabled?: boolean;
    imei?: string;
    deviceName?: string;
    createdAt: string;
    updatedAt?: string;
    source: 'local' | 'api';
    isLocal?: boolean;
}

interface GeofenceState {
    geofences: LocalGeofence[];
    apiGeofences: LocalGeofence[];
    isLoadingApi: boolean;
    apiError: string | null;
    addGeofence: (fence: LocalGeofence) => void;
    removeGeofence: (id: string) => void;
    clearAll: () => void;
    fetchApiGeofences: () => Promise<void>;
}

const storage = Platform.OS === 'web'
    ? createJSONStorage(() => localStorage)
    : createJSONStorage(() => AsyncStorage);

export const useGeofenceStore = create<GeofenceState>()(
    persist(
        (set) => ({
            geofences: [],
            apiGeofences: [],
            isLoadingApi: false,
            apiError: null,

            addGeofence: (fence) =>
                set((state) => ({ geofences: [...state.geofences, fence] })),
            removeGeofence: (id) =>
                set((state) => ({
                    geofences: state.geofences.filter((g) => g.id !== id),
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
                        const deviceFencesPromises = devices.map(async (device: any) => {
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
                    
                    const normalized: LocalGeofence[] = rawList.map((f: any, idx: number) => {
                        const fenceId = f.fenceId || f.fenceSerialNo || f.id || `api-${idx}-${Date.now()}`;
                        
                        let alarmType: 'in' | 'out' | 'in,out' = 'in,out';
                        const apiAlarmType = (f.alarmType || f.alarm_type || '').toLowerCase();
                        if (apiAlarmType === 'in') alarmType = 'in';
                        else if (apiAlarmType === 'out') alarmType = 'out';
                        else if (apiAlarmType === 'in_out' || apiAlarmType === 'in,out') alarmType = 'in,out';

                        const radius = (Number(f.radius) * 100) || 500;
                        const imei = f.imei || undefined;
                        const device = devices.find((d: any) => d.imei === imei);

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
                            source: 'api',
                            isLocal: false,
                        };
                    });
                    
                    set({ apiGeofences: normalized, isLoadingApi: false });
                } catch (err: any) {
                    set({ apiError: err.message || 'Failed to fetch API geofences', isLoadingApi: false });
                }
            },
        }),
        {
            name: 'traceplus-local-geofences',
            storage,
            partialize: (state) => ({ geofences: state.geofences }),
        }
    )
);
