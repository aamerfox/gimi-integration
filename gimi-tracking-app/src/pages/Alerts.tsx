import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import { gimiService } from '../services/gimi';
import { useGeofenceEventStore } from '../store/geofenceEvents';
import type { GeofenceEvent } from '../store/geofenceEvents';
import { useAlertRuleStore } from '../store/alertRules';
import type { AlertRuleType } from '../store/alertRules';
import { useGeofenceStore } from '../store/geofences';

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

interface ApiAlarmResult {
    result?: RawAlarm[] | { list?: RawAlarm[] };
}

interface Alarm {
    alarmId: string;
    imei: string;
    alarmType: string;
    alarmDesc: string;
    lat: number;
    lng: number;
    speed: number;
    gpsTime: string;
    deviceName?: string;
}

const ALARM_TYPE_MAP: Record<string, { label: string; icon: string; severity: 'critical' | 'warning' | 'info' }> = {
    'SOS': { label: 'SOS', icon: '🆘', severity: 'critical' },
    'offline': { label: 'Offline', icon: '📡', severity: 'warning' },
    'lowBattery': { label: 'Low Battery', icon: '🔋', severity: 'warning' },
    'overspeed': { label: 'Overspeed', icon: '🚨', severity: 'critical' },
    'geofenceIn': { label: 'Geofence Enter', icon: '📍', severity: 'info' },
    'geofenceOut': { label: 'Geofence Exit', icon: '📍', severity: 'warning' },
    'vibration': { label: 'Vibration', icon: '📳', severity: 'info' },
    'powerOff': { label: 'Power Off', icon: '⚡', severity: 'critical' },
    'lowPower': { label: 'Low Power', icon: '🔌', severity: 'warning' },
    'crash': { label: 'Crash', icon: '💥', severity: 'critical' },
    'fatigueDriving': { label: 'Fatigue Driving', icon: '😴', severity: 'warning' },
};

const getAlarmMeta = (type: string) => {
    const key = Object.keys(ALARM_TYPE_MAP).find(k => type.toLowerCase().includes(k.toLowerCase()));
    if (key) return ALARM_TYPE_MAP[key];
    return { label: type || 'Unknown', icon: '⚠️', severity: 'info' as const };
};

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'geofence', label: 'Geofence' },
    { key: 'overspeed', label: 'Speed' },
    { key: 'sos', label: 'SOS' },
    { key: 'battery', label: 'Battery' },
    { key: 'offline', label: 'Offline' },
];

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 768px)');
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    return isMobile;
}

export default function Alerts() {
    const { accessToken, userId } = useAuthStore();
    const { devices } = useDeviceStore();
    const { events: geofenceEvents, markAllRead, clearEvents } = useGeofenceEventStore();
    const { rules, addRule, removeRule, toggleRule } = useAlertRuleStore();
    const { geofences } = useGeofenceStore();
    const [alarms, setAlarms] = useState<Alarm[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const isMobile = useIsMobile();

    // Add-rule modal state
    const [showAddRule, setShowAddRule] = useState(false);
    const [ruleType, setRuleType] = useState<AlertRuleType>('geofence');
    const [ruleName, setRuleName] = useState('');
    const [ruleImei, setRuleImei] = useState('');
    const [ruleSpeedLimit, setRuleSpeedLimit] = useState(120);
    const [ruleFenceId, setRuleFenceId] = useState('');

    const handleAddRule = () => {
        if (!ruleName.trim()) return;
        const device = devices.find((d: Device) => d.imei === ruleImei);
        const fence = geofences.find(f => f.id === ruleFenceId);
        addRule({
            name: ruleName.trim(),
            type: ruleType,
            enabled: true,
            imei: ruleImei,
            deviceName: device?.deviceName,
            speedLimit: ruleType === 'overspeed' ? ruleSpeedLimit : undefined,
            fenceId: ruleType === 'geofence' ? ruleFenceId : undefined,
            fenceName: ruleType === 'geofence' ? fence?.fenceName : undefined,
        });
        setShowAddRule(false);
        setRuleName('');
        setRuleImei('');
        setRuleFenceId('');
        setRuleSpeedLimit(120);
    };

    const RULE_ICONS: Record<AlertRuleType, string> = {
        geofence: '📍', overspeed: '🚨', offline: '📡', lowBattery: '🔋',
    };
    const RULE_LABELS: Record<AlertRuleType, string> = {
        geofence: 'Geofence Enter/Exit', overspeed: 'Overspeed', offline: 'Device Offline', lowBattery: 'Low Battery',
    };

    // Mark all geofence events as read when this page opens
    useEffect(() => { markAllRead(); }, [markAllRead]);

    // Date range pickers
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) => d.toISOString().slice(0, 16);
    const [startDate, setStartDate] = useState(formatDate(sevenDaysAgo));
    const [endDate, setEndDate] = useState(formatDate(now));
    const [selectedImei, setSelectedImei] = useState('');

    // Format for API: "YYYY-MM-DD HH:mm:ss"
    const toApiDate = (d: string) => d.replace('T', ' ') + ':00';

    const fetchAlarms = useCallback(async () => {
        if (!accessToken || !userId) return;
        setIsLoading(true);
        setError(null);
        try {
            const begin = toApiDate(startDate);
            const end = toApiDate(endDate);
            let allAlarms: RawAlarm[] = [];

            if (selectedImei) {
                // Single device
                const res = await gimiService.getDeviceAlarms(accessToken, selectedImei, begin, end) as ApiAlarmResult;
                if (res?.result) {
                    allAlarms = Array.isArray(res.result) ? res.result : ((res.result as { list?: RawAlarm[] }).list || []);
                }
            } else {
                // All devices — fetch in parallel
                const imeis = devices.map((d: Device) => d.imei).filter(Boolean);
                if (imeis.length === 0) {
                    setAlarms([]);
                    setIsLoading(false);
                    return;
                }
                const results = await Promise.allSettled(
                    imeis.map(imei => gimiService.getDeviceAlarms(accessToken, imei, begin, end))
                );
                for (const r of results) {
                    if (r.status === 'fulfilled') {
                        const val = (r as PromiseFulfilledResult<ApiAlarmResult>).value;
                        if (val?.result) {
                            const list = Array.isArray(val.result)
                                ? val.result
                                : ((val.result as { list?: RawAlarm[] }).list || []);
                            allAlarms.push(...list);
                        }
                    }
                }
            }

            const parsed: Alarm[] = allAlarms.map((a: RawAlarm) => {
                let type = a.alertTypeId || a.alarmType || a.alertType || a.type || '';
                // map TSP specific type IDs
                if (type === 'in') type = 'geofenceIn';
                if (type === 'out') type = 'geofenceOut';

                const desc = a.alarmTypeName || a.alarmDesc || a.alarmName || a.desc || type || '';

                return {
                    alarmId: a.alarmId || a.id || `${a.imei}-${a.gpsTime || a.alertTime}-${Math.random()}`,
                    imei: a.imei || '',
                    alarmType: type,
                    alarmDesc: desc,
                    lat: Number(a.lat) || 0,
                    lng: Number(a.lng) || 0,
                    speed: Number(a.speed) || 0,
                    gpsTime: a.gpsTime || a.alertTime || a.time || '',
                    deviceName: a.deviceName || devices.find((d: Device) => d.imei === a.imei)?.deviceName || a.imei,
                };
            });
            // Sort by time descending
            parsed.sort((a, b) => b.gpsTime.localeCompare(a.gpsTime));
            setAlarms(parsed);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load alerts');
            setAlarms([]);
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, userId, selectedImei, startDate, endDate, devices]);

    useEffect(() => { fetchAlarms(); }, [fetchAlarms]);

    // Filter
    const filteredAlarms = alarms.filter(a => {
        if (activeFilter === 'all') return true;
        const type = a.alarmType.toLowerCase();
        if (activeFilter === 'geofence') return type.includes('fence') || type.includes('geo');
        if (activeFilter === 'overspeed') return type.includes('speed');
        if (activeFilter === 'sos') return type.includes('sos');
        if (activeFilter === 'battery') return type.includes('batt') || type.includes('power');
        if (activeFilter === 'offline') return type.includes('offline') || type.includes('disconnect');
        return true;
    });

    const severityColor = (s: string) => {
        if (s === 'critical') return 'var(--danger)';
        if (s === 'warning') return 'var(--warn)';
        return 'var(--accent)';
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: isMobile ? '12px' : '20px', overflow: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                    Alerts
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowAddRule(true)} className="sx-btn sx-btn-primary sx-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Add Alert
                    </button>
                    <button onClick={fetchAlarms} className="sx-btn sx-btn-ghost sx-btn-sm" disabled={isLoading}>
                        {isLoading ? 'Loading...' : '↻ Refresh'}
                    </button>
                </div>
            </div>

            {/* ── Add Alert Modal ── */}
            {showAddRule && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 2000,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div className="glass-panel" style={{ width: isMobile ? 'calc(100vw - 24px)' : 440, padding: '24px', borderRadius: 'var(--radius-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
                        {/* Modal header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Add Alert Rule</h3>
                            <button onClick={() => setShowAddRule(false)} className="sx-btn-icon" style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        {/* Alert type selector */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Alert Type</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {(['geofence', 'overspeed', 'offline', 'lowBattery'] as AlertRuleType[]).map(t => (
                                    <button key={t} onClick={() => setRuleType(t)}
                                        style={{
                                            padding: '10px',
                                            borderRadius: 'var(--radius-md)',
                                            border: `1px solid ${ruleType === t ? 'var(--accent)' : 'var(--border)'}`,
                                            background: ruleType === t ? 'var(--accent-dim)' : 'transparent',
                                            color: ruleType === t ? 'var(--accent)' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            fontWeight: ruleType === t ? 600 : 400,
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            transition: 'all 0.15s',
                                        }}>
                                        <span>{RULE_ICONS[t]}</span>
                                        <span>{RULE_LABELS[t]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Rule name */}
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Rule Name *</label>
                            <input
                                className="sx-input"
                                value={ruleName}
                                onChange={e => setRuleName(e.target.value)}
                                placeholder="e.g. Factory Zone Alert"
                                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                            />
                        </div>

                        {/* Device selector */}
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Device</label>
                            <select className="sx-select" value={ruleImei} onChange={e => setRuleImei(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}>
                                <option value="">All Devices</option>
                                {devices.map((d: Device) => (
                                    <option key={d.imei} value={d.imei}>{d.deviceName} ({d.imei})</option>
                                ))}
                            </select>
                        </div>

                        {/* Geofence picker */}
                        {ruleType === 'geofence' && (
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Geofence Zone</label>
                                <select className="sx-select" value={ruleFenceId} onChange={e => setRuleFenceId(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}>
                                    <option value="">Any Geofence</option>
                                    {geofences.map(f => (
                                        <option key={f.id} value={f.id}>{f.fenceName}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Speed limit */}
                        {ruleType === 'overspeed' && (
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Speed Limit (km/h)</label>
                                <input
                                    type="number" min={10} max={300}
                                    className="sx-input"
                                    value={ruleSpeedLimit}
                                    onChange={e => setRuleSpeedLimit(Number(e.target.value))}
                                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                                />
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button onClick={() => setShowAddRule(false)} className="sx-btn sx-btn-ghost">Cancel</button>
                            <button onClick={handleAddRule} className="sx-btn sx-btn-primary" disabled={!ruleName.trim()}>
                                Create Rule
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Alert Rules Section ── */}
            <div className="glass-panel-flat" style={{ marginBottom: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⚙️ Alert Rules
                        <span style={{ background: 'var(--border)', color: 'var(--text-muted)', borderRadius: '999px', padding: '1px 7px', fontSize: '10px', fontWeight: 600 }}>
                            {rules.length}
                        </span>
                    </span>
                    <button onClick={() => setShowAddRule(true)} className="sx-btn sx-btn-primary sx-btn-sm" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Add Alert
                    </button>
                </div>

                {rules.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No alert rules yet — click <strong>Add Alert</strong> to create one
                    </div>
                ) : (
                    rules.map(rule => (
                        <div key={rule.id} style={{
                            display: 'grid', gridTemplateColumns: '28px 1fr auto auto',
                            alignItems: 'center', gap: '10px',
                            padding: '10px 16px', borderBottom: '1px solid var(--border)',
                            opacity: rule.enabled ? 1 : 0.5,
                        }}>
                            <div style={{ fontSize: '16px' }}>{RULE_ICONS[rule.type]}</div>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 500 }}>{rule.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {RULE_LABELS[rule.type]}
                                    {rule.fenceName && ` · ${rule.fenceName}`}
                                    {rule.speedLimit && ` · >${rule.speedLimit} km/h`}
                                    {' · '}{rule.deviceName || 'All Devices'}
                                </div>
                            </div>
                            {/* Toggle */}
                            <button onClick={() => toggleRule(rule.id)} style={{
                                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                                background: rule.enabled ? 'var(--accent)' : 'var(--border)',
                                position: 'relative', transition: 'background 0.2s',
                                flexShrink: 0,
                            }}>
                                <span style={{
                                    position: 'absolute', top: 2, left: rule.enabled ? 18 : 2,
                                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                                    transition: 'left 0.2s',
                                }} />
                            </button>
                            {/* Delete */}
                            <button onClick={() => removeRule(rule.id)} className="sx-btn-icon" style={{
                                width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                background: 'transparent', color: 'var(--danger)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* ── Live Geofence Events ── */}
            {geofenceEvents.length > 0 && (
                <div className="glass-panel-flat" style={{ marginBottom: '16px', overflow: 'hidden' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--border)',
                        background: 'rgba(0,212,170,0.04)',
                    }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px' }}>📡</span>
                            Live Geofence Events
                            <span style={{
                                background: 'var(--accent)',
                                color: '#0a0e1a',
                                borderRadius: '999px',
                                padding: '1px 7px',
                                fontSize: '10px',
                                fontWeight: 700,
                            }}>{geofenceEvents.length}</span>
                        </span>
                        <button
                            onClick={clearEvents}
                            className="sx-btn sx-btn-ghost sx-btn-sm"
                            style={{ fontSize: '11px' }}
                        >
                            Clear All
                        </button>
                    </div>

                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {geofenceEvents.map((evt: GeofenceEvent) => {
                            const isEntered = evt.eventType === 'entered';
                            const color = isEntered ? 'var(--accent)' : 'var(--warn)';
                            return (
                                <div key={evt.id} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '28px 1fr auto',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '10px 16px',
                                    borderBottom: '1px solid var(--border)',
                                    background: evt.read ? 'transparent' : `${color}08`,
                                }}>
                                    {/* Icon */}
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: `${color}18`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '13px',
                                    }}>
                                        {isEntered ? '📍' : '🚧'}
                                    </div>

                                    {/* Content */}
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 500 }}>
                                            <span style={{ color }}>{isEntered ? 'Entered' : 'Exited'}</span>
                                            {' '}<strong>{evt.fenceName}</strong>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {evt.deviceName} · {Number(evt.lat || 0).toFixed(5)}, {Number(evt.lng || 0).toFixed(5)}
                                        </div>
                                    </div>

                                    {/* Time */}
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {new Date(evt.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters bar */}
            <div className="glass-panel-flat" style={{ padding: '12px 16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Device selector */}
                    <select
                        value={selectedImei}
                        onChange={(e) => setSelectedImei(e.target.value)}
                        className="sx-select"
                        style={{ width: '200px', padding: '6px 10px', fontSize: '12px' }}
                    >
                        <option value="">All Devices</option>
                        {devices.map((d: Device) => (
                            <option key={d.imei} value={d.imei}>{d.deviceName}</option>
                        ))}
                    </select>

                    {/* Date range */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="sx-input"
                            style={{ width: '175px', padding: '6px 8px', fontSize: '12px' }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
                        <input
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="sx-input"
                            style={{ width: '175px', padding: '6px 8px', fontSize: '12px' }}
                        />
                    </div>

                    <button onClick={fetchAlarms} className="sx-btn sx-btn-primary sx-btn-sm">
                        Search
                    </button>
                </div>
            </div>

            {/* Type filters */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {FILTERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setActiveFilter(f.key)}
                        className={`sx-btn sx-btn-sm ${activeFilter === f.key ? 'sx-btn-primary' : 'sx-btn-ghost'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="glass-panel-flat" style={{ padding: '12px 16px', marginBottom: '12px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: '13px' }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Results */}
            <div className="glass-panel-flat" style={{ flex: 1, overflow: 'auto' }}>
                {isLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading alerts...</div>
                ) : filteredAlarms.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 12px' }}>
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>No alerts found</div>
                        <div style={{ fontSize: '12px' }}>Try adjusting the date range or filters</div>
                    </div>
                ) : (
                    <>
                        {/* Table header — desktop only */}
                        {!isMobile && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '40px 1.5fr 1fr 1fr 80px 1.2fr',
                                padding: '10px 16px',
                                borderBottom: '1px solid var(--border)',
                                fontSize: '10px',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                position: 'sticky',
                                top: 0,
                                background: 'var(--bg-secondary)',
                                zIndex: 1,
                            }}>
                                <div></div>
                                <div>Alert</div>
                                <div>Device</div>
                                <div>Type</div>
                                <div>Speed</div>
                                <div>Time</div>
                            </div>
                        )}

                        {/* Rows */}
                        {filteredAlarms.map((alarm) => {
                            const meta = getAlarmMeta(alarm.alarmType);
                            return isMobile ? (
                                /* ── Mobile: card layout ── */
                                <div
                                    key={alarm.alarmId}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border)',
                                        display: 'flex',
                                        gap: '12px',
                                        alignItems: 'flex-start',
                                    }}
                                >
                                    <div style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px' }}>{meta.icon}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{alarm.alarmDesc || meta.label}</span>
                                            <span style={{
                                                display: 'inline-block', padding: '1px 7px',
                                                borderRadius: '20px', fontSize: '10px', fontWeight: 600,
                                                background: `${severityColor(meta.severity)}18`,
                                                color: severityColor(meta.severity),
                                                border: `1px solid ${severityColor(meta.severity)}30`,
                                            }}>{meta.label}</span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                            {alarm.deviceName}
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                            {alarm.speed > 0 && <span>🚗 {alarm.speed} km/h</span>}
                                            <span>🕐 {alarm.gpsTime}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* ── Desktop: grid row layout ── */
                                <div
                                    key={alarm.alarmId}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '40px 1.5fr 1fr 1fr 80px 1.2fr',
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border)',
                                        alignItems: 'center',
                                        transition: 'background 0.15s',
                                        cursor: 'default',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <div style={{ fontSize: '16px' }}>{meta.icon}</div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{alarm.alarmDesc || meta.label}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {Number(alarm.lat || 0).toFixed(4)}, {Number(alarm.lng || 0).toFixed(4)}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{alarm.deviceName}</div>
                                    <div>
                                        <span style={{
                                            display: 'inline-block', padding: '2px 8px',
                                            borderRadius: '20px', fontSize: '10px', fontWeight: 600,
                                            background: `${severityColor(meta.severity)}18`,
                                            color: severityColor(meta.severity),
                                            border: `1px solid ${severityColor(meta.severity)}30`,
                                        }}>
                                            {meta.label}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', fontWeight: 500 }}>
                                        {alarm.speed > 0 ? `${alarm.speed} km/h` : '—'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{alarm.gpsTime}</div>
                                </div>
                            );
                        })}

                        {/* Summary */}
                        <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                            {filteredAlarms.length} alert{filteredAlarms.length !== 1 ? 's' : ''} found
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
