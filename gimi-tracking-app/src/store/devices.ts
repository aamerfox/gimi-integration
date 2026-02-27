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
    positionType?: string;
    posType?: string;          // API live location field (e.g. 'GPS')
    battery?: number;
    batteryPowerVal?: string;  // API battery percentage as string
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
        const updated = devices.map((dev) => {
            const loc = locations.find((l) => l.imei === dev.imei);
            if (loc) {
                return {
                    ...dev,
                    ...loc,
                    deviceName: dev.deviceName, // Prevent location payload from overwriting actual name
                    icon: dev.icon
                };
            }
            return dev;
        });
        set({ devices: updated });

        // Also update selected device if it matches
        const { selectedDevice } = get();
        if (selectedDevice) {
            const updatedSelected = updated.find((d) => d.imei === selectedDevice.imei);
            if (updatedSelected) set({ selectedDevice: updatedSelected });
        }
    },

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
}));
