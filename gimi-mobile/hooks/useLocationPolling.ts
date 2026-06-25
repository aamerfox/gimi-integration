import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { useDeviceStore } from '@/store/devices';
import { gimiService } from '@/services/gimi';
import { customApi } from '@/services/api';
import { useSimulationStore } from '@/store/simulation';

interface ApiDeviceListResult {
  result?: any[];
}

interface ApiLocationResult {
  result?: any[];
}

export function useLocationPolling(intervalMs = 15000) {
  const { accessToken, userId } = useAuthStore();
  const { setDevices, updateDeviceLocations, setLoading, setError } = useDeviceStore();

  const fetchDevices = useCallback(async () => {
    if (!accessToken || !userId) return;
    try {
      const res = await gimiService.getDeviceList(accessToken, userId) as ApiDeviceListResult;
      if (res?.result && Array.isArray(res.result)) {
        setDevices(res.result);
      }
    } catch (err: any) {
      console.error('[Global Location Polling] fetchDevices error:', err);
      setError(err?.message || 'Failed to load devices');
    }
  }, [accessToken, userId, setDevices, setError]);

  const fetchLocations = useCallback(async () => {
    if (!accessToken || !userId) return;
    try {
      const res = await gimiService.getDevicesLocation(accessToken, userId) as ApiLocationResult;
      if (res?.result && Array.isArray(res.result)) {
        updateDeviceLocations(res.result);
      }
    } catch (err: any) {
      console.error('[Global Location Polling] fetchLocations error:', err);
      setError(err?.message || 'Failed to load device locations');
    }
  }, [accessToken, userId, updateDeviceLocations, setError]);

  useEffect(() => {
    if (!accessToken) return;
    
    // Sync custom sub-accounts from SQLite backend on mount
    const syncCustomAccounts = async () => {
      try {
        const allRes = await customApi.get('/sub-accounts');
        if (allRes?.data?.code === 0 && Array.isArray(allRes.data.result)) {
          useSimulationStore.getState().setSimulatedChildAccounts(allRes.data.result);
        }
      } catch (e) {
        console.error('[Global Location Polling] Failed to sync sub-accounts:', e);
      }
    };

    setLoading(true);
    syncCustomAccounts().then(() => {
      fetchDevices()
        .then(() => fetchLocations())
        .finally(() => setLoading(false));
    });

    // Polling interval
    const interval = setInterval(fetchLocations, intervalMs);
    return () => clearInterval(interval);
  }, [accessToken, fetchDevices, fetchLocations, intervalMs, setLoading]);
}
