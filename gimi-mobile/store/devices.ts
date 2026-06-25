import { create } from 'zustand';

export interface Device {
    imei: string;
    deviceName: string;
    icon: string;
    status: string;       // '1' = online, '0' = offline
    lat?: number;
    lng?: number;
    speed?: number;
    course?: number;
    direction?: number;
    gpsTime?: string;
    sysTime?: string;
    positionType?: string;
    posType?: string;
    battery?: number;
    batteryPowerVal?: string;
    accStatus?: string;
}

interface DeviceState {
    devices: Device[];
    selectedDevice: Device | null;
    isLoading: boolean;
    error: string | null;
    setDevices: (devices: Device[]) => void;
    selectDevice: (device: Device | null) => void;
    updateDeviceLocations: (locations: Partial<Device>[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

export const useDeviceStore = create<DeviceState>()((set, get) => ({
    devices: [],
    selectedDevice: null,
    isLoading: false,
    error: null,

    setDevices: (devices) => set({ devices }),
    selectDevice: (device) => set({ selectedDevice: device }),

    updateDeviceLocations: (locations) => {
        const { devices } = get();
        const updated = [...devices];

        locations.forEach((loc) => {
            if (!loc.imei) return;
            const idx = updated.findIndex((d) => d.imei === loc.imei);
            if (idx > -1) {
                updated[idx] = {
                    ...updated[idx],
                    ...loc,
                    deviceName: updated[idx].deviceName || loc.deviceName || `Device ${loc.imei}`,
                    icon: updated[idx].icon || loc.icon || 'automobile',
                };
            } else {
                updated.push({
                    imei: loc.imei,
                    deviceName: loc.deviceName || `Device ${loc.imei}`,
                    icon: loc.icon || 'automobile',
                    status: loc.status || '0',
                    ...loc,
                } as Device);
            }
        });

        set({ devices: updated });

        const { selectedDevice } = get();
        if (selectedDevice) {
            const updatedSelected = updated.find((d) => d.imei === selectedDevice.imei);
            if (updatedSelected) set({ selectedDevice: updatedSelected });
        }
    },

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
}));
