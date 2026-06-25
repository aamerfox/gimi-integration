import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import { gimiService } from '../services/gimi';
import { customApi } from '../services/api';
import { useSimulationStore } from '../store/simulation';

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
            const res = await gimiService.getDeviceList(accessToken, userId) as unknown as ApiResponse<Device[]>;
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
            const res = await gimiService.getDevicesLocation(accessToken, userId) as unknown as ApiResponse<Partial<Device>[]>;
            if (res?.result && Array.isArray(res.result)) {
                updateDeviceLocations(res.result);
            }
        } catch {
            // Silently fail
        }
    }, [accessToken, userId, updateDeviceLocations]);

    useEffect(() => {
        if (!accessToken) return;

        // Sync custom sub-accounts from SQLite backend on mount/load
        const syncCustomAccounts = async () => {
            try {
                const allRes = await customApi.get('/sub-accounts');
                if (allRes?.data?.code === 0 && Array.isArray(allRes.data.result)) {
                    useSimulationStore.setState({ simulatedChildAccounts: allRes.data.result });
                }
            } catch (e) {
                console.error('Failed to sync custom sub-accounts on polling start:', e);
            }
        };

        // Initialize sync, then load devices and locations
        syncCustomAccounts().then(() => {
            fetchDevices().then(fetchLocations);
        });

        // Poll locations every intervalMs
        const interval = setInterval(fetchLocations, intervalMs);
        return () => clearInterval(interval);
    }, [accessToken, fetchDevices, fetchLocations, intervalMs]);
}
