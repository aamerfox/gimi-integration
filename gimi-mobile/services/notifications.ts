import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';

// ── Channel ID for Android
const CHANNEL_ID = 'fleet-alerts';

/**
 * Configure how notifications are handled when the app is in the foreground.
 * We show them as banners so the user sees alerts even while using the app.
 */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

/**
 * Request notification permissions and create the Android notification channel.
 * Call once on app startup.
 */
export async function initNotifications(): Promise<boolean> {
    // Create Android notification channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: 'Fleet Alerts',
            description: 'Geofence, overspeed, battery, and SOS alerts from your fleet',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            enableVibrate: true,
            enableLights: true,
            lightColor: '#00d4aa',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    return finalStatus === 'granted';
}

/**
 * Format alarm data into a notification matching TrackSolid Pro style.
 */
function formatAlarmNotification(alarm: {
    alarmType: string;
    alarmDesc: string;
    deviceName: string;
    speed?: number;
    imei?: string;
}): { title: string; body: string } {
    const type = alarm.alarmType.toLowerCase();
    const devLabel = alarm.deviceName || alarm.imei || 'Unknown Device';

    // Geofence Enter
    if (type.includes('geofencein') || type.includes('enter') || type === 'in') {
        // Match TrackSolid Pro format: "Enter geo-fence(FenceName)(DeviceName)"
        const fenceMatch = alarm.alarmDesc.match(/\(([^)]+)\)/);
        const fenceName = fenceMatch ? fenceMatch[1] : '';
        const title = fenceName
            ? `Enter geo-fence(${fenceName})(${devLabel})`
            : `Enter geo-fence(${devLabel})`;
        return {
            title: `Enter geo-fence(${fenceName || devLabel})`,
            body: title,
        };
    }

    // Geofence Exit
    if (type.includes('geofenceout') || type.includes('exit') || type === 'out') {
        const fenceMatch = alarm.alarmDesc.match(/\(([^)]+)\)/);
        const fenceName = fenceMatch ? fenceMatch[1] : '';
        const title = fenceName
            ? `Exit geo-fence(${fenceName})(${devLabel})`
            : `Exit geo-fence(${devLabel})`;
        return {
            title: `Exit geo-fence(${fenceName || devLabel})`,
            body: title,
        };
    }

    // Overspeed
    if (type.includes('overspeed') || type.includes('speed')) {
        return {
            title: `Overspeed Alert`,
            body: alarm.speed
                ? `${devLabel} exceeded speed limit (${alarm.speed} km/h)`
                : `${devLabel} — Overspeed detected`,
        };
    }

    // Low Battery
    if (type.includes('battery') || type.includes('lowpower') || type.includes('low_power')) {
        return {
            title: `Low Battery Warning`,
            body: `${devLabel} — Battery is low`,
        };
    }

    // SOS
    if (type.includes('sos')) {
        return {
            title: `🚨 SOS Alert`,
            body: `SOS triggered on ${devLabel}`,
        };
    }

    // Power Off
    if (type.includes('poweroff') || type.includes('power_off')) {
        return {
            title: `Power Off Alert`,
            body: `${devLabel} has been powered off`,
        };
    }

    // Vibration
    if (type.includes('vibration')) {
        return {
            title: `Vibration Alert`,
            body: `Vibration detected on ${devLabel}`,
        };
    }

    // Offline
    if (type.includes('offline')) {
        return {
            title: `Device Offline`,
            body: `${devLabel} went offline`,
        };
    }

    // Default
    return {
        title: alarm.alarmDesc || 'Fleet Alert',
        body: `${devLabel} — ${alarm.alarmDesc || alarm.alarmType}`,
    };
}

/**
 * Fire a local push notification for an alarm event.
 */
export async function sendAlarmNotification(alarm: {
    alarmType: string;
    alarmDesc: string;
    deviceName: string;
    speed?: number;
    imei?: string;
    alarmId?: string;
}): Promise<void> {
    const { title, body } = formatAlarmNotification(alarm);

    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
                screen: 'alerts',
                alarmId: alarm.alarmId,
                imei: alarm.imei,
            },
            ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
        },
        trigger: null, // Fire immediately
    });
}

/**
 * Set up the notification response handler.
 * When user taps a notification, navigate to the Alerts tab.
 */
export function setupNotificationResponseHandler(): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.screen === 'alerts') {
            // Navigate to Alerts tab
            try {
                router.navigate('/(tabs)/alerts');
            } catch {
                // Router not ready yet — will open to default screen
            }
        }
    });
}

/**
 * Get the current notification badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
    try {
        await Notifications.setBadgeCountAsync(count);
    } catch {
        // Some devices don't support badge count
    }
}
