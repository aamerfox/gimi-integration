import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useThemeStore } from '@/store/theme';
import COLORS from '@/constants/Colors';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocationPolling } from '@/hooks/useLocationPolling';
import { useGeofenceDetection } from '@/hooks/useGeofenceDetection';
import { useGeofenceEventStore } from '@/store/geofenceEvents';
import { useAlarmStateStore } from '@/store/alarmState';

export default function TabLayout() {
  const { theme } = useThemeStore();
  const { t } = useTranslation();
  const C = COLORS[theme];
  const insets = useSafeAreaInsets();

  // Run global coordinate polling
  useLocationPolling();

  // Run global client-side geofence boundary detection
  useGeofenceDetection();

  const { unreadCount: geofenceUnread } = useGeofenceEventStore();
  const { unreadCount: alarmUnread } = useAlarmStateStore();
  const totalUnread = geofenceUnread + alarmUnread;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          bottom: insets.bottom > 0 ? insets.bottom + 12 : (Platform.OS === 'android' ? 36 : 16),
          left: 16,
          right: 16,
          backgroundColor: C.bgCard,
          borderRadius: 24,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: C.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: theme === 'dark' ? 0.35 : 0.12,
          shadowRadius: 16,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        headerStyle: { backgroundColor: C.bgSecondary },
        headerTintColor: C.textPrimary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.map'),
          tabBarIcon: ({ color, size }) => <Feather name="map" size={size || 24} color={color} />,
          headerTitle: t('tabs.map'),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ color, size }) => <Feather name="clock" size={size || 24} color={color} />,
          headerTitle: t('tabs.history'),
        }}
      />
      <Tabs.Screen
        name="geofences"
        options={{
          title: t('tabs.geofences'),
          tabBarIcon: ({ color, size }) => <Feather name="hexagon" size={size || 24} color={color} />,
          headerTitle: t('tabs.geofences'),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t('tabs.alerts'),
          tabBarIcon: ({ color, size }) => <Feather name="bell" size={size || 24} color={color} />,
          headerTitle: t('tabs.alerts'),
          tabBarBadge: totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ef4444', color: '#fff', fontSize: 10, fontWeight: '700' },
        }}
      />
      <Tabs.Screen
        name="share"
        options={{
          title: t('tabs.share'),
          tabBarIcon: ({ color, size }) => <Feather name="share-2" size={size || 24} color={color} />,
          headerTitle: t('tabs.share'),
        }}
      />
    </Tabs>
  );
}
