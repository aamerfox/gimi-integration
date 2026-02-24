import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import { gimiService } from '../services/gimi';

interface ApiResponse<T = unknown> {
    code: number;
    message: string;
    result: T;
}

/**
 * useLocationPolling
 *
 * Fetches live device locations every 15 seconds, globally.
 * Mount once in DashboardLayout so polling continues on ALL pages,
 * not just the Dashboard page.
 */
export function useLocationPolling(intervalMs = 15000) {
    const { accessToken, userId } = useAuthStore();
    const { setDevices, updateDeviceLocations } = useDeviceStore();

    const fetchDevices = useCallback(async () => {
        if (!accessToken || !userId) return;
        try {
            const res = await gimiService.getDeviceList(accessToken, userId) as ApiResponse<Device[]>;
            if (res?.result && Array.isArray(res.result)) {
                setDevices(res.result);
            }
        } catch {
            // Silently fail — stale data is acceptable
        }
    }, [accessToken, userId, setDevices]);

    const fetchLocations = useCallback(async () => {
        if (!accessToken || !userId) return;
        try {
            const res = await gimiService.getDevicesLocation(accessToken, userId) as ApiResponse<Partial<Device>[]>;
            if (res?.result && Array.isArray(res.result)) {
                updateDeviceLocations(res.result);
            }
        } catch {
            // Silently fail
        }
    }, [accessToken, userId, updateDeviceLocations]);

    useEffect(() => {
        if (!accessToken) return;
        // Initial load
        fetchDevices().then(fetchLocations);
        // Poll locations every intervalMs
        const interval = setInterval(fetchLocations, intervalMs);
        return () => clearInterval(interval);
    }, [accessToken, fetchDevices, fetchLocations, intervalMs]);
}
