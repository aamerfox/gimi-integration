import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/auth';
import { useDeviceStore } from '@/store/devices';
import { useThemeStore } from '@/store/theme';
import { useLanguageStore } from '@/store/language';
import COLORS from '@/constants/Colors';
import '@/localization/i18n';

// ── Push Notifications ──
import { initNotifications, setupNotificationResponseHandler } from '@/services/notifications';
import { registerAlarmPolling, cacheDevicesForPoller } from '@/services/alarmPoller';
// IMPORTANT: This import registers the background task at the top level
import '@/services/alarmPoller';

function AuthGuard() {
  const { accessToken } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  // isReady becomes true after the Stack has had its first render pass
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Deferred to next event-loop tick so the Stack navigator is fully mounted
    const id = setTimeout(() => setIsReady(true), 1);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (!accessToken && inAuthGroup) {
      router.replace('/login');
    } else if (accessToken && !inAuthGroup && segments[0] !== 'share') {
      router.replace('/(tabs)');
    }
  }, [isReady, accessToken, segments]);

  return null;
}

/**
 * Bootstraps the notification system:
 * - Requests permissions
 * - Creates Android notification channel
 * - Registers background alarm polling
 * - Handles notification tap → navigate to Alerts
 * - Caches device list for background poller
 */
function NotificationBootstrap() {
  const { accessToken } = useAuthStore();
  const { devices } = useDeviceStore();
  const initRef = useRef(false);

  // Initialize notifications once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      const granted = await initNotifications();
      if (granted) {
        await registerAlarmPolling();
      }
    })();

    // Set up tap handler
    const sub = setupNotificationResponseHandler();
    return () => sub.remove();
  }, []);

  // Cache device list whenever it changes (for background poller access)
  useEffect(() => {
    if (devices.length > 0 && accessToken) {
      cacheDevicesForPoller(
        devices.map(d => ({ imei: d.imei, deviceName: d.deviceName }))
      );
    }
  }, [devices, accessToken]);

  return null;
}

export default function RootLayout() {
  const { theme } = useThemeStore();
  const C = COLORS[theme];
  const [hydrated, setHydrated] = useState(() => useLanguageStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useLanguageStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  if (!hydrated) return null; // or a splash screen

  return (
    <>
      <AuthGuard />
      <NotificationBootstrap />
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bgSecondary },
          headerTintColor: C.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: C.bgPrimary },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="share"
          options={{
            title: 'Shared Location',
            headerStyle: { backgroundColor: C.bgSecondary },
            headerTintColor: C.textPrimary,
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
