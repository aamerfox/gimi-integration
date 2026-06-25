import React, { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, I18nManager, Alert, DevSettings } from 'react-native';
import { useAuthStore } from '@/store/auth';
import { useDeviceStore } from '@/store/devices';
import { useThemeStore } from '@/store/theme';
import { useLanguageStore } from '@/store/language';
import COLORS from '@/constants/Colors';
import i18n from '@/localization/i18n';

// ── Google Fonts ──
import { 
  useFonts,
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold 
} from '@expo-google-fonts/tajawal';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_700Bold
} from '@expo-google-fonts/cairo';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_700Bold
} from '@expo-google-fonts/barlow';

// Global Font Injection for Arabic (Cairo for Bold headings, Tajawal for Body) and English/Numbers (Barlow)
// Global Font Injection for Arabic (Cairo for Bold headings, Tajawal for Body) and English/Numbers (Barlow)
try {
  const TextComponent = Text as any;
  const oldRender = TextComponent.render;
  if (typeof oldRender === 'function') {
    TextComponent.render = function (...args: any[]) {
      try {
        const origin = oldRender.call(this, ...args);
        if (!origin || !React.isValidElement(origin) || !origin.props) {
          return origin;
        }

        const lang = useLanguageStore.getState().language;
        let weight = 'regular';
        const style = (origin.props as any).style;
        if (style) {
          const flatStyle = StyleSheet.flatten(style);
          if (flatStyle && flatStyle.fontWeight) {
            const fw = String(flatStyle.fontWeight);
            if (fw === 'bold' || fw === '700' || fw === '800' || fw === '900') {
              weight = 'bold';
            } else if (fw === '500' || fw === '600' || fw === 'medium') {
              weight = 'medium';
            }
          }
        }

        const fontFamily = lang === 'ar'
          ? (weight === 'bold' ? 'Cairo_700Bold' : (weight === 'medium' ? 'Tajawal_500Medium' : 'Tajawal_400Regular'))
          : (weight === 'bold' ? 'Barlow_700Bold' : (weight === 'medium' ? 'Barlow_500Medium' : 'Barlow_400Regular'));

        return React.cloneElement(origin, {
          style: [
            { fontFamily },
            style,
            // Avoid double-bolding/layout issues on Android when custom fonts are used
            Platform.OS === 'android' ? { fontWeight: 'normal' } : null,
          ],
        } as any);
      } catch (err) {
        console.warn('Text render monkey patch error:', err);
        return oldRender.apply(this, args);
      }
    };
  }
} catch (err) {
  console.warn('Failed to monkeypatch Text component:', err);
}


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
    const safeDevices = Array.isArray(devices) ? devices : [];
    if (safeDevices.length > 0 && accessToken) {
      cacheDevicesForPoller(
        safeDevices.map(d => ({ imei: d.imei, deviceName: d.deviceName }))
      );
    }
  }, [devices, accessToken]);

  return null;
}

export default function RootLayout() {
  const { theme } = useThemeStore();
  const C = COLORS[theme];
  const [hydrated, setHydrated] = useState(() => useLanguageStore.persist.hasHydrated());

  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_700Bold,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_700Bold,
  });

  useEffect(() => {
    const unsub = useLanguageStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  // Sync i18n and RTL layout direction once store hydration finishes
  useEffect(() => {
    if (hydrated) {
      const lang = useLanguageStore.getState().language;
      if (i18n.language !== lang) {
        i18n.changeLanguage(lang);
      }

      if (Platform.OS !== 'web') {
        const isRTL = lang === 'ar';
        const currentRTL = I18nManager.isRTL;
        if (currentRTL !== isRTL) {
          I18nManager.allowRTL(isRTL);
          I18nManager.forceRTL(isRTL);

          if (__DEV__) {
            DevSettings.reload();
          } else {
            Alert.alert(
              lang === 'ar' ? 'مزامنة اللغة والاتجاه' : 'Language Sync',
              lang === 'ar'
                ? 'تم تغيير اتجاه اللغة. يرجى إعادة تشغيل التطبيق بالكامل لتفعيل اتجاه اللغة العربية (RTL) بشكل صحيح.'
                : 'Language direction changed. Please restart the app completely to apply English layout direction (LTR) correctly.',
              [{ text: lang === 'ar' ? 'حسناً' : 'OK' }]
            );
          }
        }
      } else {
        const isRTL = lang === 'ar';
        document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
      }
    }
  }, [hydrated]);

  if (!hydrated || !fontsLoaded) return null; // or a splash screen

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
