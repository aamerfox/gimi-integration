import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { sendAlarmNotification, setBadgeCount } from './notifications';
import { api } from './api';

// ── Constants
export const ALARM_POLL_TASK = 'ALARM_POLL_TASK';
const POLL_STORAGE_KEY = 'alarm-state-storage';
const AUTH_STORAGE_KEY = 'traceplus-auth';
const DEVICE_CACHE_KEY = 'alarm-poller-device-cache';

// ── Types
interface RawAlarm {
    alarmId?: string;
    id?: string;
    imei?: string;
    alarmType?: string;
    alertType?: string;
    alertTypeId?: string;
    type?: string;
    alarmDesc?: string;
    alarmName?: string;
    alarmTypeName?: string;
    desc?: string;
    lat?: number;
    lng?: number;
    speed?: number;
    gpsTime?: string;
    alertTime?: string;
    time?: string;
    deviceName?: string;
}

/**
 * Read persisted Zustand store from AsyncStorage.
 * We need this because background tasks can't access React hooks.
 */
async function readPersistedStore<T>(key: string): Promise<T | null> {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.state || null;
    } catch {
        return null;
    }
}

/**
 * Read auth from SecureStore (same storage the auth Zustand store uses).
 */
async function readAuthFromSecureStore(): Promise<{
    accessToken: string | null;
    userId: string | null;
} | null> {
    try {
        let raw: string | null = null;
        if (Platform.OS === 'web') {
            raw = typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_STORAGE_KEY) : null;
        } else {
            raw = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
        }
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.state || null;
    } catch {
        return null;
    }
}

/**
 * Read cached device list, or return empty array.
 */
async function readCachedDevices(): Promise<Array<{ imei: string; deviceName: string }>> {
    try {
        const raw = await AsyncStorage.getItem(DEVICE_CACHE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/**
 * Cache the device list for background task use.
 * Call this from the foreground whenever devices are loaded.
 */
export async function cacheDevicesForPoller(
    devices: Array<{ imei: string; deviceName: string }>
): Promise<void> {
    try {
        await AsyncStorage.setItem(DEVICE_CACHE_KEY, JSON.stringify(devices));
    } catch {
        // Silent
    }
}

/**
 * Update a specific field in a persisted Zustand store.
 */
async function updatePersistedStore(key: string, updates: Record<string, any>): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.state) {
            Object.assign(parsed.state, updates);
            await AsyncStorage.setItem(key, JSON.stringify(parsed));
        }
    } catch {
        // Silent fail in background
    }
}

/**
 * Format a Date to UTC "YYYY-MM-DD HH:mm:ss" for the GIMI API.
 */
function formatUtcTime(d: Date): string {
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/**
 * The actual polling logic — called both by background task and foreground timer.
 */
export async function pollForNewAlarms(): Promise<number> {
    // 1. Read auth state from SecureStore
    const authState = await readAuthFromSecureStore();

    if (!authState?.accessToken || !authState?.userId) {
        return 0; // Not logged in
    }

    // 2. Read cached device list
    const devices = await readCachedDevices();
    if (devices.length === 0) {
        return 0; // No devices cached
    }

    // 3. Read alarm state (for deduplication)
    const alarmState = await readPersistedStore<{
        lastSeenAlarmIds: string[];
        unreadCount: number;
        notificationsEnabled: boolean;
    }>(POLL_STORAGE_KEY);

    if (!alarmState?.notificationsEnabled) {
        return 0; // Notifications disabled
    }

    const seenIds = new Set(alarmState?.lastSeenAlarmIds || []);

    // 4. Fetch recent alarms (last 30 minutes)
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const beginTime = formatUtcTime(thirtyMinAgo);
    const endTime = formatUtcTime(now);

    const allNewAlarms: Array<{
        alarmId: string;
        alarmType: string;
        alarmDesc: string;
        deviceName: string;
        speed: number;
        imei: string;
    }> = [];

    // Query each device (max 5 concurrent)
    const batchSize = 5;
    for (let i = 0; i < devices.length; i += batchSize) {
        const batch = devices.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map((device) =>
                api.post('', {
                    method: 'jimi.device.alarm.list',
                    access_token: authState.accessToken,
                    imei: device.imei,
                    begin_time: beginTime,
                    end_time: endTime,
                    page_no: '1',
                    page_size: '20',
                })
            )
        );

        for (let j = 0; j < results.length; j++) {
            const r = results[j];
            if (r.status !== 'fulfilled') continue;

            const res = r.value as any;
            let rawAlarms: RawAlarm[] = [];

            if (Array.isArray(res?.result)) {
                rawAlarms = res.result;
            } else if (res?.result?.list) {
                rawAlarms = res.result.list;
            }

            const device = batch[j];

            for (const a of rawAlarms) {
                const alarmId =
                    a.alarmId ||
                    a.id ||
                    `${a.imei || device.imei}-${a.gpsTime || a.alertTime || a.time}-${a.alarmType || a.alertTypeId || ''}`;

                // Skip already-seen alarms
                if (seenIds.has(alarmId)) continue;

                let type = a.alertTypeId || a.alarmType || a.alertType || a.type || 'unknown';
                if (type === 'in') type = 'geofenceIn';
                if (type === 'out') type = 'geofenceOut';

                allNewAlarms.push({
                    alarmId,
                    alarmType: type,
                    alarmDesc:
                        a.alarmTypeName || a.alarmDesc || a.alarmName || a.desc || type || '',
                    deviceName:
                        a.deviceName || device.deviceName || device.imei,
                    speed: Number(a.speed) || 0,
                    imei: a.imei || device.imei,
                });
            }
        }
    }

    // 5. Send notifications for new alarms
    if (allNewAlarms.length > 0) {
        // Send up to 10 notifications to avoid spamming
        const toNotify = allNewAlarms.slice(0, 10);

        for (const alarm of toNotify) {
            await sendAlarmNotification(alarm);
        }

        // 6. Update persisted state
        const newIds = allNewAlarms.map((a) => a.alarmId);
        const combinedIds = [...new Set([...newIds, ...(alarmState?.lastSeenAlarmIds || [])])].slice(0, 200);
        const newUnreadCount = (alarmState?.unreadCount || 0) + allNewAlarms.length;

        await updatePersistedStore(POLL_STORAGE_KEY, {
            lastSeenAlarmIds: combinedIds,
            lastPollTime: Date.now(),
            unreadCount: newUnreadCount,
        });

        // Update badge
        await setBadgeCount(newUnreadCount);
    } else {
        // Update poll time even if no new alarms
        await updatePersistedStore(POLL_STORAGE_KEY, {
            lastPollTime: Date.now(),
        });
    }

    return allNewAlarms.length;
}

/**
 * Define the background task. This must be called at the TOP LEVEL
 * (not inside a component) so it's registered before the app mounts.
 */
TaskManager.defineTask(ALARM_POLL_TASK, async () => {
    try {
        const newCount = await pollForNewAlarms();
        return newCount > 0
            ? BackgroundFetch.BackgroundFetchResult.NewData
            : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (err) {
        console.error('[AlarmPoller] Background task error:', err);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

/**
 * Register the background fetch task.
 * Call once on app startup (after notification permissions are granted).
 */
export async function registerAlarmPolling(): Promise<void> {
    try {
        // Check if already registered
        const isRegistered = await TaskManager.isTaskRegisteredAsync(ALARM_POLL_TASK);
        if (isRegistered) {
            return; // Already registered
        }

        await BackgroundFetch.registerTaskAsync(ALARM_POLL_TASK, {
            minimumInterval: 3 * 60, // 3 minutes (Android respects this; iOS uses ~15 min)
            stopOnTerminate: false,   // Continue polling after app is closed (Android)
            startOnBoot: true,        // Start polling when device boots (Android)
        });

        console.log('[AlarmPoller] Background polling registered');
    } catch (err) {
        console.error('[AlarmPoller] Failed to register background polling:', err);
    }
}

/**
 * Unregister the background fetch task.
 */
export async function unregisterAlarmPolling(): Promise<void> {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(ALARM_POLL_TASK);
        if (isRegistered) {
            await BackgroundFetch.unregisterTaskAsync(ALARM_POLL_TASK);
            console.log('[AlarmPoller] Background polling unregistered');
        }
    } catch (err) {
        console.error('[AlarmPoller] Failed to unregister:', err);
    }
}
