import { useState, useCallback, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, ScrollView, Platform, Modal, TextInput, AppState
} from 'react-native';
import { useAuthStore } from '@/store/auth';
import { useDeviceStore, Device } from '@/store/devices';
import { useThemeStore } from '@/store/theme';
import { useGeofenceEventStore, GeofenceEvent } from '@/store/geofenceEvents';
import { useAlertRuleStore, AlertRule, AlertRuleType } from '@/store/alertRules';
import { useGeofenceStore } from '@/store/geofences';
import { useAlarmStateStore } from '@/store/alarmState';
import { gimiService } from '@/services/gimi';
import { setBadgeCount } from '@/services/notifications';
import COLORS from '@/constants/Colors';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { formatGimiTime } from '@/utils/time';

// ── Types
interface RawAlarm {
    alarmId?: string; id?: string; imei?: string;
    alarmType?: string; alertType?: string; alertTypeId?: string; type?: string;
    alarmDesc?: string; alarmName?: string; alarmTypeName?: string; desc?: string;
    lat?: number; lng?: number; speed?: number;
    gpsTime?: string; alertTime?: string; time?: string;
    deviceName?: string;
}
interface Alarm {
    alarmId: string; imei: string; alarmType: string;
    alarmDesc: string; lat: number; lng: number;
    speed: number; gpsTime: string; deviceName?: string;
}

const ALARM_TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
    'SOS': { label: 'SOS', icon: 'alert-triangle', color: '#ef4444' },
    'offline': { label: 'Offline', icon: 'wifi-off', color: '#f59e0b' },
    'lowBattery': { label: 'Low Battery', icon: 'battery', color: '#f59e0b' },
    'lowPower': { label: 'Low Power', icon: 'zap-off', color: '#f59e0b' },
    'overspeed': { label: 'Overspeed', icon: 'alert-circle', color: '#ef4444' },
    'geofenceIn': { label: 'Geofence Enter', icon: 'log-in', color: '#0891b2' },
    'geofenceOut': { label: 'Geofence Exit', icon: 'log-out', color: '#f59e0b' },
    'vibration': { label: 'Vibration', icon: 'activity', color: '#94a3b8' },
    'powerOff': { label: 'Power Off', icon: 'power', color: '#ef4444' },
    'crash': { label: 'Crash', icon: 'x-octagon', color: '#ef4444' },
    'fatigueDriving': { label: 'Fatigue', icon: 'eye-off', color: '#f59e0b' },
};

const getAlarmMeta = (type: string) => {
    const key = Object.keys(ALARM_TYPE_MAP).find(k => type.toLowerCase().includes(k.toLowerCase()));
    return key ? ALARM_TYPE_MAP[key] : { label: type || 'Alert', icon: 'alert-triangle', color: '#94a3b8' };
};

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'geofence', label: 'Geofence' },
    { key: 'battery', label: 'Battery' },
];

export default function AlertsScreen() {
    const { t } = useTranslation();
    const { accessToken, userId } = useAuthStore();
    const { devices } = useDeviceStore();
    const { theme } = useThemeStore();
    const { events: geofenceEvents, markAllRead, clearEvents } = useGeofenceEventStore();
    const { rules, addRule, removeRule, toggleRule } = useAlertRuleStore();
    const { 
        geofences: localGeofences, 
        apiGeofences, 
        fetchApiGeofences 
    } = useGeofenceStore();
    
    const safeDevices = Array.isArray(devices) ? devices : [];
    const C = COLORS[theme || 'dark'] || COLORS.dark;

    // Combine local geofences and API geofences for the picker
    const safeApiFences = Array.isArray(apiGeofences) ? apiGeofences : [];
    const safeLocalFences = Array.isArray(localGeofences) ? localGeofences : [];
    const combinedGeofences = [
        ...safeApiFences,
        ...safeLocalFences.map(g => ({ ...g, isLocal: true }))
    ];

    // Fetch API geofences on mount or when devices load
    const fetchedRef = useRef(false);
    useEffect(() => {
        if (!fetchedRef.current || (devices.length > 0 && !fetchedRef.current)) {
            fetchApiGeofences();
            if (devices.length > 0) {
                fetchedRef.current = true;
            }
        }
    }, [fetchApiGeofences, devices.length]);

    // Determine if this account has its own geofences
    const hasOwnGeofences = safeApiFences.length > 0 || safeLocalFences.length > 0;

    const FILTERS = [
        { key: 'all', label: t('alertsFilters.all') },
        // Only show geofence filter if the account has geofences
        ...(hasOwnGeofences ? [{ key: 'geofence', label: t('alertsFilters.geofence') }] : []),
        { key: 'battery', label: t('alertsFilters.battery') },
    ];
    const refreshLabel = t('alertsFilters.refresh');

    // Modal state for Add Rule
    const [showAddRule, setShowAddRule] = useState(false);
    const [ruleType, setRuleType] = useState<AlertRuleType>('geofence');
    const [ruleName, setRuleName] = useState('');
    const [ruleImei, setRuleImei] = useState('');
    const [ruleSpeedLimit, setRuleSpeedLimit] = useState('120');
    const [ruleFenceId, setRuleFenceId] = useState('');

    const handleAddRule = () => {
        if (!ruleName.trim()) return;
        const device = safeDevices.find((d: Device) => d.imei === ruleImei);
        const fence = combinedGeofences.find(f => f.id === ruleFenceId);
        addRule({
            name: ruleName.trim(),
            type: ruleType,
            enabled: true,
            imei: ruleImei,
            deviceName: device?.deviceName,
            speedLimit: ruleType === 'overspeed' ? parseInt(ruleSpeedLimit) || 120 : undefined,
            fenceId: ruleType === 'geofence' ? ruleFenceId : undefined,
            fenceName: ruleType === 'geofence' ? fence?.fenceName : undefined,
        });
        setShowAddRule(false);
        setRuleName(''); setRuleImei(''); setRuleFenceId(''); setRuleSpeedLimit('120');
    };

    const [alarms, setAlarms] = useState<Alarm[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('all');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // Clear unread badge when user views the Alerts tab
    const { clearUnread, lastPollTime } = useAlarmStateStore();
    useEffect(() => {
        markAllRead();
        clearUnread();
        setBadgeCount(0);
    }, [markAllRead, clearUnread]);

    // Auto-refresh every 60 seconds when Alerts tab is active
    const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        autoRefreshRef.current = setInterval(() => {
            fetchAlarms();
        }, 60000);
        return () => {
            if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
        };
    }, []);

    const fetchAlarms = useCallback(async () => {
        if (!accessToken || !userId) return;
        setLoading(true); setError(null);
        try {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
            const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
            const imeis = safeDevices.map((d: Device) => d.imei);

            // Fetch alarms for each device (max 5 concurrent to avoid rate-limiting)
            const results = await Promise.allSettled(
                imeis.map((imei: string) =>
                    gimiService.getDeviceAlarms(accessToken, imei, fmt(weekAgo), fmt(now)) as Promise<{ result?: RawAlarm[] | { list?: RawAlarm[] } }>
                )
            );

            const raw: RawAlarm[] = [];
            for (const r of results) {
                if (r.status !== 'fulfilled') continue;
                const res = r.value;
                if (Array.isArray(res?.result)) raw.push(...(res.result as RawAlarm[]));
                else if ((res?.result as { list?: RawAlarm[] })?.list) raw.push(...(res.result as { list: RawAlarm[] }).list);
            }

            const mapped: Alarm[] = raw.map((a: RawAlarm) => {
                let type = a.alertTypeId || a.alarmType || a.alertType || a.type || 'unknown';
                if (type === 'in') type = 'geofenceIn';
                if (type === 'out') type = 'geofenceOut';

                const desc = a.alarmTypeName || a.alarmDesc || a.alarmName || a.desc || type || '';
                const devName = a.deviceName || safeDevices.find((d: Device) => d.imei === a.imei)?.deviceName || a.imei || '';

                return {
                    alarmId: a.alarmId || a.id || `${a.imei}-${a.gpsTime || a.alertTime}-${Math.random()}`,
                    imei: a.imei || '',
                    alarmType: type,
                    alarmDesc: desc,
                    lat: Number(a.lat) || 0, lng: Number(a.lng) || 0,
                    speed: Number(a.speed) || 0,
                    gpsTime: a.gpsTime || a.alertTime || a.time || '',
                    deviceName: devName,
                };
            });

            // Also merge local geofence events for OCI accounts
            const allowedImeis = safeDevices.map((d: Device) => d.imei).filter(Boolean);
            const localGeofenceAlarms: Alarm[] = (geofenceEvents || [])
                .filter((evt) => allowedImeis.includes(evt.imei))
                .map((evt) => {
                    const isEntered = evt.type === 'enter';
                    const alarmType = isEntered ? 'geofenceIn' : 'geofenceOut';
                    const alarmDesc = isEntered
                        ? `Enter geo-fence(${evt.fenceName})`
                        : `Exit geo-fence(${evt.fenceName})`;
                    const gpsTime = evt.timestamp.replace('T', ' ').slice(0, 19);

                    return {
                        alarmId: `local-${evt.imei}-${evt.timestamp}-${Math.random()}`,
                        imei: evt.imei,
                        alarmType,
                        alarmDesc,
                        lat: evt.lat || 0,
                        lng: evt.lng || 0,
                        speed: 0,
                        gpsTime,
                        deviceName: evt.deviceName || safeDevices.find((d: Device) => d.imei === evt.imei)?.deviceName || evt.imei || '',
                    };
                });

            const combinedAlarms = [...mapped, ...localGeofenceAlarms];
            // Sort newest first
            combinedAlarms.sort((a, b) => (b.gpsTime > a.gpsTime ? 1 : -1));
            setAlarms(combinedAlarms);
            setPage(1);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load alarms');
        } finally { setLoading(false); }
    }, [accessToken, userId, safeDevices, geofenceEvents]);


    useEffect(() => { fetchAlarms(); }, [fetchAlarms]);

    // Helper: is this alarm a geofence type?
    const isGeofenceAlarm = (type: string) => {
        const t = type.toLowerCase();
        return t.includes('geofence') || t.includes('fence') || t === 'in' || t === 'out';
    };

    // Filter alarms — skip geofence alarms if the account has no own geofences (unless it is a local event)
    const filteredAlarms = alarms.filter(a => {
        // If account has no geofences, hide all geofence-type alarms
        if (!hasOwnGeofences && isGeofenceAlarm(a.alarmType) && !a.alarmId.startsWith('local-')) return false;


        if (filter === 'all') return true;
        if (filter === 'geofence') return isGeofenceAlarm(a.alarmType);
        if (filter === 'sos') return a.alarmType.toLowerCase().includes('sos');
        if (filter === 'battery') return a.alarmType.toLowerCase().includes('battery') || a.alarmType.toLowerCase().includes('power');
        return a.alarmType.toLowerCase().includes(filter);
    });
    const paged = filteredAlarms.slice(0, page * PAGE_SIZE);

    const s = styles(C);

    const renderAlarm = ({ item }: { item: Alarm }) => {
        const meta = getAlarmMeta(item.alarmType);

        // Intercept raw API English strings and translate them if possible
        let translatedDesc = item.alarmDesc || meta.label;
        const enterMatch = translatedDesc.match(/Enter geo-fence(\(.*\))?/i);
        const exitMatch = translatedDesc.match(/Exit geo-fence(\(.*\))?/i);

        if (enterMatch) {
            translatedDesc = `${t('alertDesc.enterGeofence')} \u202A${enterMatch[1] || ''}\u202C`;
        } else if (exitMatch) {
            translatedDesc = `${t('alertDesc.exitGeofence')} \u202A${exitMatch[1] || ''}\u202C`;
        }

        return (
            <View style={s.alarmItem}>
                <View style={[s.alarmIcon, { backgroundColor: `${meta.color}20` }]}>
                    <Feather name={meta.icon as any} size={20} color={meta.color} />
                </View>
                <View style={s.alarmInfo}>
                    <View style={s.alarmTitleRow}>
                        <Text style={s.alarmType}>{translatedDesc}</Text>
                        {item.speed > 0 && (
                            <Text style={[s.alarmSpeed, { color: meta.color }]}>{item.speed} km/h</Text>
                        )}
                    </View>
                    <Text style={s.alarmDevice} numberOfLines={1}>{item.deviceName || item.imei}</Text>
                    <Text style={s.alarmTime}>{formatGimiTime(item.gpsTime)}</Text>
                </View>
                <View style={[s.severityDot, { backgroundColor: meta.color }]} />
            </View>
        );
    };



    return (
        <View style={s.container}>
            {/* ── Header */}
            <View style={s.headerBar}>
                <Text style={s.headerTitle}>{t('alerts.alarms')} ({alarms.length})</Text>
            </View>

            {/* ── Filter bar */}
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={s.filterBar}
                contentContainerStyle={s.filterBarContent}
            >
                {FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.key}
                        style={[s.filterChip, filter === f.key && s.filterChipActive]}
                        onPress={() => setFilter(f.key)}
                    >
                        <Text style={[s.filterText, filter === f.key && { color: C.accent }]} numberOfLines={1}>{f.label}</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.refreshChip} onPress={fetchAlarms}>
                    <Text style={[s.filterText, { color: C.accent }]} numberOfLines={1}>⟳ {refreshLabel}</Text>
                </TouchableOpacity>
            </ScrollView>

            {error && <Text style={s.errorText}>{error}</Text>}
            {loading && <ActivityIndicator color={C.accent} style={{ marginVertical: 8 }} />}

            <FlatList
                data={paged}
                keyExtractor={a => a.alarmId}
                renderItem={renderAlarm}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 90 }}
                onEndReached={() => { if (paged.length < filteredAlarms.length) setPage(p => p + 1); }}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={
                    <Text style={[s.emptyText, { color: C.textMuted }]}>
                        {loading ? t('alerts.loadingAlarms') : t('alerts.noAlarms')}
                    </Text>
                }
            />
        </View>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgPrimary },

    headerBar: {
        backgroundColor: C.bgSecondary, borderBottomWidth: 1, borderColor: C.border,
        paddingVertical: 14, paddingHorizontal: 16,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: C.textPrimary },

    filterBar: { backgroundColor: C.bgSecondary, borderBottomWidth: 1, borderColor: C.border },
    filterBarContent: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignItems: 'center',
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border,
        flexShrink: 0,
    },
    filterChipActive: { backgroundColor: `${C.accent}15`, borderColor: C.accent },
    filterText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
    refreshChip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border,
        flexShrink: 0,
    },

    errorText: { color: C.danger, fontSize: 12, textAlign: 'center', padding: 6 },
    emptyText: { textAlign: 'center', marginTop: 32, fontSize: 14, lineHeight: 22 },

    alarmItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 12,
        borderBottomWidth: 1, borderColor: C.border, gap: 10,
    },
    alarmIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    alarmInfo: { flex: 1 },
    alarmTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    alarmType: { fontSize: 14, fontWeight: '700', color: C.textPrimary, flex: 1 },
    alarmSpeed: { fontSize: 12, fontWeight: '700' },
    alarmDevice: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
    alarmTime: { fontSize: 11, color: C.textMuted, marginTop: 2 },
    severityDot: { width: 8, height: 8, borderRadius: 4 },

    ruleItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 10,
        borderBottomWidth: 1, borderColor: C.border, gap: 10,
    },
    toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    toggleText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    deleteBtn: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center',
    },
    deleteBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },

    eventHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 10,
        borderBottomWidth: 1, borderColor: C.border,
    },
    eventCount: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
    clearBtn: { fontSize: 13, fontWeight: '600' },

    emptyRules: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
});
