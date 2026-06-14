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

type TabKey = 'alarms' | 'events' | 'rules';

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
    const C = COLORS[theme];

    // Combine local geofences and API geofences for the picker
    const combinedGeofences = [
        ...apiGeofences,
        ...localGeofences.map(g => ({ ...g, isLocal: true }))
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

    const FILTERS = [
        { key: 'all', label: t('alertsFilters.all') },
        { key: 'geofence', label: t('alertsFilters.geofence') },
        { key: 'battery', label: t('alertsFilters.battery') },
    ];

    // Modal state for Add Rule
    const [showAddRule, setShowAddRule] = useState(false);
    const [ruleType, setRuleType] = useState<AlertRuleType>('geofence');
    const [ruleName, setRuleName] = useState('');
    const [ruleImei, setRuleImei] = useState('');
    const [ruleSpeedLimit, setRuleSpeedLimit] = useState('120');
    const [ruleFenceId, setRuleFenceId] = useState('');

    const handleAddRule = () => {
        if (!ruleName.trim()) return;
        const device = devices.find((d: Device) => d.imei === ruleImei);
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

    const [tab, setTab] = useState<TabKey>('alarms');
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
        if (tab === 'alarms') {
            autoRefreshRef.current = setInterval(() => {
                fetchAlarms();
            }, 60000);
        }
        return () => {
            if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
        };
    }, [tab]);

    const fetchAlarms = useCallback(async () => {
        if (!accessToken || !userId) return;
        setLoading(true); setError(null);
        try {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
            const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
            const imeis = devices.map((d: Device) => d.imei);

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
                const devName = a.deviceName || devices.find((d: Device) => d.imei === a.imei)?.deviceName || a.imei || '';

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
            // Sort newest first
            mapped.sort((a, b) => (b.gpsTime > a.gpsTime ? 1 : -1));
            setAlarms(mapped);
            setPage(1);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load alarms');
        } finally { setLoading(false); }
    }, [accessToken, userId, devices]);

    useEffect(() => { if (tab === 'alarms') fetchAlarms(); }, [tab, fetchAlarms]);

    // Filter alarms
    const filteredAlarms = alarms.filter(a => {
        if (filter === 'all') return true;
        if (filter === 'geofence') return a.alarmType.toLowerCase().includes('geofence') || a.alarmType.toLowerCase().includes('fence');
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

    const renderEvent = ({ item }: { item: GeofenceEvent }) => (
        <View style={s.alarmItem}>
            <View style={[s.alarmIcon, { backgroundColor: `${item.type === 'enter' ? C.online : C.warning}20` }]}>
                <Feather name={item.type === 'enter' ? 'log-in' : 'log-out'} size={20} color={item.type === 'enter' ? C.online : C.warning} />
            </View>
            <View style={s.alarmInfo}>
                <Text style={s.alarmType}>{item.type === 'enter' ? 'Geofence Enter' : 'Geofence Exit'}</Text>
                <Text style={s.alarmDevice}>{item.deviceName} → {item.fenceName}</Text>
                <Text style={s.alarmTime}>{new Date(item.timestamp).toLocaleString()}</Text>
            </View>
        </View>
    );

    const renderRule = ({ item }: { item: AlertRule }) => (
        <View style={s.ruleItem}>
            <View style={[s.alarmIcon, { backgroundColor: `${C.accent}15` }]}>
                <Feather 
                   name={item.type === 'geofence' ? 'map-pin' : item.type === 'overspeed' ? 'alert-circle' : item.type === 'offline' ? 'wifi-off' : 'battery'} 
                   size={18} color={C.accent} 
                />
            </View>
            <View style={s.alarmInfo}>
                <Text style={s.alarmType}>{item.name}</Text>
                <Text style={s.alarmDevice}>
                    {item.deviceName || (item.imei ? item.imei : 'All devices')}
                    {item.speedLimit ? ` · ${item.speedLimit} km/h` : ''}
                    {item.fenceName ? ` · ${item.fenceName}` : ''}
                </Text>
            </View>
            <TouchableOpacity
                style={[s.toggleBtn, { backgroundColor: item.enabled ? `${C.accent}20` : C.bgElevated }]}
                onPress={() => toggleRule(item.id)}
            >
                <Text style={[s.toggleText, { color: item.enabled ? C.accent : C.textMuted }]}>
                    {item.enabled ? 'ON' : 'OFF'}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.deleteBtn} onPress={() => removeRule(item.id)}>
                <Text style={s.deleteBtnText}>✕</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={s.container}>
            {/* ── Top tab bar */}
            <View style={s.tabBar}>
                {([
                    { key: 'alarms', label: `Alarms (${alarms.length})` },
                    { key: 'events', label: `Events (${geofenceEvents.length})` },
                    { key: 'rules', label: `Rules (${rules.length})` },
                ] as { key: TabKey; label: string }[]).map(t => (
                    <TouchableOpacity
                        key={t.key}
                        style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
                        onPress={() => setTab(t.key)}
                    >
                        <Text style={[s.tabBtnText, tab === t.key && { color: C.accent }]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── Alarm filter bar */}
            {tab === 'alarms' && (
                <>
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
                                <Text style={[s.filterText, filter === f.key && { color: C.accent }]}>{f.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={s.refreshChip} onPress={fetchAlarms}>
                            <Text style={[s.filterText, { color: C.accent }]}>⟳ Refresh</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {error && <Text style={s.errorText}>{error}</Text>}
                    {loading && <ActivityIndicator color={C.accent} style={{ marginVertical: 8 }} />}

                    <FlatList
                        data={paged}
                        keyExtractor={a => a.alarmId}
                        renderItem={renderAlarm}
                        showsVerticalScrollIndicator={false}
                        onEndReached={() => { if (paged.length < filteredAlarms.length) setPage(p => p + 1); }}
                        onEndReachedThreshold={0.3}
                        ListEmptyComponent={
                            <Text style={[s.emptyText, { color: C.textMuted }]}>
                                {loading ? 'Loading alarms...' : 'No alarms in the last 7 days'}
                            </Text>
                        }
                    />
                </>
            )}

            {/* ── Geofence events */}
            {tab === 'events' && (
                <>
                    <View style={s.eventHeader}>
                        <Text style={s.eventCount}>{geofenceEvents.length} events</Text>
                        <TouchableOpacity onPress={clearEvents}>
                            <Text style={[s.clearBtn, { color: C.danger }]}>Clear all</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={[...geofenceEvents].reverse()}
                        keyExtractor={(e, i) => `${e.fenceId}-${i}`}
                        renderItem={renderEvent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <Text style={[s.emptyText, { color: C.textMuted }]}>No geofence events recorded</Text>
                        }
                    />
                </>
            )}

            {/* ── Alert rules */}
            {tab === 'rules' && (
                <>
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                        <TouchableOpacity style={[s.tabBtnActive, { backgroundColor: C.accent, padding: 12, borderRadius: 8, alignItems: 'center' }]} onPress={() => setShowAddRule(true)}>
                            <Text style={{ color: C.bgPrimary, fontWeight: '700' }}>+ {t('common.add')} Rule</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={rules}
                        keyExtractor={r => r.id}
                        renderItem={renderRule}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={s.emptyRules}>
                                <Feather name="settings" size={40} color={C.textMuted} style={{ marginBottom: 8 }} />
                                <Text style={[s.emptyText, { color: C.textMuted }]}>
                                    No alert rules yet.{'\n'}Create rules to track your fleet.
                                </Text>
                            </View>
                        }
                    />

                    {/* Add Rule Modal */}
                    <Modal visible={showAddRule} transparent animationType="slide">
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
                            <View style={{ backgroundColor: C.bgPrimary, borderRadius: 12, padding: 20 }}>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: C.textPrimary, marginBottom: 16 }}>Create Alert Rule</Text>

                                <Text style={{ color: C.textSecondary, marginBottom: 6 }}>{t('devices.deviceName')} / IMEI</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
                                    <TouchableOpacity
                                        style={[s.filterChip, !ruleImei && s.filterChipActive]}
                                        onPress={() => setRuleImei('')}>
                                        <Text style={[s.filterText, !ruleImei && { color: C.accent }]}>All</Text>
                                    </TouchableOpacity>
                                    {devices.map(d => (
                                        <TouchableOpacity
                                            key={d.imei}
                                            style={[s.filterChip, ruleImei === d.imei && s.filterChipActive]}
                                            onPress={() => setRuleImei(d.imei)}>
                                            <Text style={[s.filterText, ruleImei === d.imei && { color: C.accent }]}>{d.deviceName}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <Text style={{ color: C.textSecondary, marginBottom: 6 }}>Type</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                    {(['geofence', 'lowBattery'] as AlertRuleType[]).map(rt => (
                                        <TouchableOpacity
                                            key={rt}
                                            style={[s.filterChip, ruleType === rt && s.filterChipActive]}
                                            onPress={() => setRuleType(rt)}>
                                            <Text style={[s.filterText, ruleType === rt && { color: C.accent }]}>{rt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={{ color: C.textSecondary, marginBottom: 6 }}>Rule Name</Text>
                                <TextInput
                                    style={{ backgroundColor: C.bgSecondary, color: C.textPrimary, padding: 12, borderRadius: 8, marginBottom: 16 }}
                                    placeholder="Enter rule name"
                                    placeholderTextColor={C.textMuted}
                                    value={ruleName}
                                    onChangeText={setRuleName}
                                />

                                {ruleType === 'geofence' && (
                                    <>
                                        <Text style={{ color: C.textSecondary, marginBottom: 6 }}>Geofence Zone</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
                                            <TouchableOpacity
                                                style={[s.filterChip, !ruleFenceId && s.filterChipActive]}
                                                onPress={() => setRuleFenceId('')}>
                                                <Text style={[s.filterText, !ruleFenceId && { color: C.accent }]}>Any Geofence</Text>
                                            </TouchableOpacity>
                                            {combinedGeofences.map(f => (
                                                <TouchableOpacity
                                                    key={f.id}
                                                    style={[s.filterChip, ruleFenceId === f.id && s.filterChipActive]}
                                                    onPress={() => setRuleFenceId(f.id)}>
                                                    <Text style={[s.filterText, ruleFenceId === f.id && { color: C.accent }]}>
                                                        {f.fenceName}{f.isLocal ? ' (Local)' : ''}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </>
                                )}

                                {ruleType === 'overspeed' && (
                                    <>
                                        <Text style={{ color: C.textSecondary, marginBottom: 6 }}>Speed Limit (km/h)</Text>
                                        <TextInput
                                            style={{ backgroundColor: C.bgSecondary, color: C.textPrimary, padding: 12, borderRadius: 8, marginBottom: 16 }}
                                            placeholder="120"
                                            keyboardType="numeric"
                                            value={ruleSpeedLimit}
                                            onChangeText={setRuleSpeedLimit}
                                        />
                                    </>
                                )}

                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                                    <TouchableOpacity style={{ padding: 12 }} onPress={() => setShowAddRule(false)}>
                                        <Text style={{ color: C.textSecondary, fontWeight: '600' }}>{t('common.cancel')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={{ padding: 12, backgroundColor: C.accent, borderRadius: 8 }} onPress={handleAddRule}>
                                        <Text style={{ color: C.bgPrimary, fontWeight: '700' }}>{t('common.save')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                </>
            )}
        </View>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgPrimary },

    tabBar: { flexDirection: 'row', backgroundColor: C.bgSecondary, borderBottomWidth: 1, borderColor: C.border },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabBtnActive: { borderBottomWidth: 2, borderBottomColor: C.accent },
    tabBtnText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },

    filterBar: { backgroundColor: C.bgSecondary, borderBottomWidth: 1, borderColor: C.border, height: 50 },
    filterBarContent: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border,
    },
    filterChipActive: { backgroundColor: `${C.accent}15`, borderColor: C.accent },
    filterText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
    refreshChip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border,
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
