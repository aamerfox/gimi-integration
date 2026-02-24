import { useState, useEffect, useRef, useCallback } from 'react';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import { useGeofenceStore, FENCE_COLORS } from '../store/geofences';
import type { LocalGeofence } from '../store/geofences';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type AlarmType = 'in' | 'out' | 'in,out';

export default function Geofences() {
    const { devices } = useDeviceStore();
    const { geofences, addGeofence, removeGeofence, toggleGeofence } = useGeofenceStore();

    // ── Form state ────────────────────────────────────────────────────────────
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    // Form fields
    const [pickLat, setPickLat] = useState<number | null>(null);
    const [pickLng, setPickLng] = useState<number | null>(null);
    const [fenceName, setFenceName] = useState('');
    const [fenceDesc, setFenceDesc] = useState('');
    const [fenceRadius, setFenceRadius] = useState(500);
    const [fenceAlarm, setFenceAlarm] = useState<AlarmType>('in,out');
    const [fenceImei, setFenceImei] = useState('');
    const [fenceColor, setFenceColor] = useState(FENCE_COLORS[0]);

    // ── Map refs ──────────────────────────────────────────────────────────────
    const [mapReady, setMapReady] = useState(false);
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const previewCircleRef = useRef<L.Circle | null>(null);
    const previewMarkerRef = useRef<L.Marker | null>(null);
    const fenceLayersRef = useRef<L.Layer[]>([]);
    const deviceMarkersRef = useRef<L.Marker[]>([]);

    // ── Init map ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, { center: [24.7136, 46.6753], zoom: 6, zoomControl: true });
        L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
        mapRef.current = map;
        setTimeout(() => { map.invalidateSize(); setMapReady(true); }, 150);

        map.on('click', (e: L.LeafletMouseEvent) => {
            setPickLat(e.latlng.lat);
            setPickLng(e.latlng.lng);
            setShowForm(true);
            setFormError(null);
        });

        return () => { map.remove(); mapRef.current = null; };
    }, []);

    // ── Draw device markers ───────────────────────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        deviceMarkersRef.current.forEach(m => m.remove());
        deviceMarkersRef.current = [];

        devices.forEach((device: Device) => {
            if (!device.lat || !device.lng) return;
            const online = device.status === '1';
            const color = online ? '#00d4aa' : '#6b7280';
            const icon = L.divIcon({
                className: '',
                iconSize: [22, 22],
                iconAnchor: [11, 11],
                html: `<div style="
                    width:22px;height:22px;border-radius:50%;
                    background:${color};border:3px solid #fff;
                    box-shadow:0 0 12px ${online ? 'rgba(0,212,170,0.6)' : 'rgba(107,114,128,0.4)'};
                "></div>`,
            });
            const m = L.marker([device.lat, device.lng], { icon })
                .addTo(map)
                .bindPopup(`
                    <div style="min-width:160px;font-family:sans-serif">
                        <strong style="font-size:13px">${device.deviceName}</strong><br/>
                        <span style="color:#888;font-size:11px">${device.imei}</span><br/>
                        <hr style="margin:6px 0;border-color:#eee"/>
                        <table style="font-size:12px;width:100%">
                            <tr><td style="color:#888">Status</td><td style="color:${online ? '#00d4aa' : '#888'};font-weight:600">${online ? 'Online' : 'Offline'}</td></tr>
                            <tr><td style="color:#888">Speed</td><td>${device.speed != null ? device.speed + ' km/h' : 'N/A'}</td></tr>
                            <tr><td style="color:#888">GPS</td><td>${device.lat?.toFixed(5)}, ${device.lng?.toFixed(5)}</td></tr>
                        </table>
                    </div>
                `);
            deviceMarkersRef.current.push(m);
        });
    }, [devices, mapReady]);

    // ── Draw all geofences ────────────────────────────────────────────────────
    const drawFences = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;
        fenceLayersRef.current.forEach(l => l.remove());
        fenceLayersRef.current = [];

        geofences.forEach((gf: LocalGeofence) => {
            if (!gf.lat || !gf.lng) return;
            const opacity = gf.enabled ? 0.15 : 0.05;
            const strokeOpacity = gf.enabled ? 1 : 0.3;
            const circle = L.circle([gf.lat, gf.lng], {
                radius: gf.radius,
                color: gf.color,
                fillColor: gf.color,
                fillOpacity: opacity,
                weight: gf.enabled ? 2 : 1,
                opacity: strokeOpacity,
                dashArray: gf.enabled ? undefined : '6 4',
            }).addTo(map).bindPopup(`
                <div style="min-width:150px;font-family:sans-serif">
                    <strong style="font-size:13px">${gf.fenceName}</strong>
                    ${gf.description ? `<br/><span style="font-size:11px;color:#888">${gf.description}</span>` : ''}
                    <hr style="margin:6px 0;border-color:#eee"/>
                    <table style="font-size:12px;width:100%">
                        <tr><td style="color:#888">Radius</td><td>${gf.radius}m</td></tr>
                        <tr><td style="color:#888">Trigger</td><td>${gf.alarmType === 'in,out' ? 'Enter & Exit' : gf.alarmType === 'in' ? 'Enter only' : 'Exit only'}</td></tr>
                        <tr><td style="color:#888">Device</td><td>${gf.deviceName || 'All devices'}</td></tr>
                        <tr><td style="color:#888">Status</td><td style="color:${gf.enabled ? '#00d4aa' : '#9ca3af'}">${gf.enabled ? 'Active' : 'Disabled'}</td></tr>
                    </table>
                </div>
            `);
            fenceLayersRef.current.push(circle);
        });
    }, [geofences]);

    useEffect(() => { if (mapReady) drawFences(); }, [geofences, mapReady, drawFences]);

    // ── Preview circle while placing ──────────────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        previewCircleRef.current?.remove();
        previewMarkerRef.current?.remove();

        if (pickLat !== null && pickLng !== null) {
            previewCircleRef.current = L.circle([pickLat, pickLng], {
                radius: fenceRadius,
                color: fenceColor,
                fillColor: fenceColor,
                fillOpacity: 0.2,
                weight: 2,
                dashArray: '8 4',
            }).addTo(map);
            previewMarkerRef.current = L.marker([pickLat, pickLng], {
                icon: L.divIcon({
                    className: '',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                    html: `<div style="width:16px;height:16px;border-radius:50%;background:${fenceColor};border:3px solid #fff;box-shadow:0 0 10px rgba(0,212,170,0.5)"></div>`,
                }),
            }).addTo(map);
        }
    }, [pickLat, pickLng, fenceRadius, fenceColor]);

    // ── Create geofence ───────────────────────────────────────────────────────
    const handleCreate = () => {
        if (!fenceName.trim()) { setFormError('Fence name is required'); return; }
        if (pickLat === null || pickLng === null) { setFormError('Click on the map first'); return; }
        setSaving(true);

        const device = devices.find((d: Device) => d.imei === fenceImei);
        addGeofence({
            fenceName: fenceName.trim(),
            description: fenceDesc.trim() || undefined,
            lat: pickLat,
            lng: pickLng,
            radius: fenceRadius,
            alarmType: fenceAlarm,
            color: fenceColor,
            imei: fenceImei || undefined,
            deviceName: device?.deviceName,
        });

        setSuccessMsg(`Geofence "${fenceName.trim()}" created ✓`);
        resetForm();
        setSaving(false);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    // ── Delete geofence ───────────────────────────────────────────────────────
    const handleDelete = (gf: LocalGeofence) => {
        if (!confirm(`Delete geofence "${gf.fenceName}"?`)) return;
        removeGeofence(gf.id);
        setSuccessMsg(`"${gf.fenceName}" deleted`);
        setTimeout(() => setSuccessMsg(null), 2000);
    };

    const resetForm = () => {
        setShowForm(false);
        setPickLat(null);
        setPickLng(null);
        setFenceName('');
        setFenceDesc('');
        setFenceRadius(500);
        setFenceAlarm('in,out');
        setFenceImei('');
        setFenceColor(FENCE_COLORS[geofences.length % FENCE_COLORS.length]);
        setFormError(null);
        previewCircleRef.current?.remove();
        previewMarkerRef.current?.remove();
    };

    const flyTo = (gf: LocalGeofence) => {
        if (mapRef.current && gf.lat && gf.lng) {
            mapRef.current.flyTo([gf.lat, gf.lng], 15, { duration: 1 });
        }
    };

    const activeCount = geofences.filter(g => g.enabled).length;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
            {/* Map */}
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {/* ─── Left panel: Geofence list ─────────────────────────────── */}
            <div
                className="glass-panel animate-slide-left"
                style={{
                    position: 'absolute', top: 16, left: 16,
                    width: 320, maxHeight: 'calc(100% - 32px)',
                    zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                            </svg>
                            Geofences
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                                style={{
                                    fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                                    borderRadius: '999px', background: 'rgba(0,212,170,0.15)',
                                    color: 'var(--accent)', border: '1px solid rgba(0,212,170,0.3)',
                                }}
                            >
                                {activeCount} active
                            </span>
                            {geofences.length > 0 && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    / {geofences.length}
                                </span>
                            )}
                        </div>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                        📍 Click anywhere on the map to add a zone
                    </p>
                </div>

                {/* Status messages */}
                {successMsg && (
                    <div style={{ margin: '8px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '12px', fontWeight: 500 }}>
                        ✓ {successMsg}
                    </div>
                )}

                {/* Geofence list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {geofences.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }}>
                                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                                <line x1="12" y1="8" x2="12" y2="16" />
                                <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                            <p style={{ fontSize: '13px', fontWeight: 500 }}>No geofences yet</p>
                            <p style={{ fontSize: '11px', marginTop: '4px' }}>Click anywhere on the map to define a zone</p>
                        </div>
                    ) : (
                        geofences.map((gf: LocalGeofence) => (
                            <div
                                key={gf.id}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: `1px solid ${gf.enabled ? 'var(--border)' : 'rgba(255,255,255,0.05)'}`,
                                    marginBottom: '6px',
                                    opacity: gf.enabled ? 1 : 0.55,
                                    transition: 'all 0.15s',
                                }}
                            >
                                {/* Row 1: color dot + name + toggle + delete */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div
                                        style={{
                                            width: 12, height: 12, borderRadius: '50%',
                                            background: gf.color, flexShrink: 0,
                                            boxShadow: gf.enabled ? `0 0 6px ${gf.color}88` : 'none',
                                        }}
                                    />
                                    <span
                                        style={{ fontSize: '13px', fontWeight: 600, flex: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        onClick={() => flyTo(gf)}
                                        title={`Fly to ${gf.fenceName}`}
                                    >
                                        {gf.fenceName}
                                    </span>

                                    {/* Toggle */}
                                    <button
                                        onClick={() => toggleGeofence(gf.id)}
                                        title={gf.enabled ? 'Disable fence' : 'Enable fence'}
                                        style={{
                                            width: 28, height: 16, borderRadius: '999px', border: 'none', cursor: 'pointer',
                                            background: gf.enabled ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                                            position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                                        }}
                                    >
                                        <div style={{
                                            position: 'absolute', top: 2,
                                            left: gf.enabled ? '50%' : '2px',
                                            width: 12, height: 12, borderRadius: '50%', background: '#fff',
                                            transition: 'left 0.2s',
                                        }} />
                                    </button>

                                    {/* Delete */}
                                    <button
                                        onClick={() => handleDelete(gf)}
                                        title="Delete"
                                        style={{
                                            width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                                            border: 'none', background: 'transparent', cursor: 'pointer',
                                            color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            opacity: 0.6, transition: 'opacity 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Row 2: meta info */}
                                <div style={{ marginTop: '6px', marginLeft: '20px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                        ⭕ {gf.radius}m
                                    </span>
                                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                        {gf.alarmType === 'in,out' ? '↕ Both' : gf.alarmType === 'in' ? '↘ Enter' : '↗ Exit'}
                                    </span>
                                    {gf.deviceName ? (
                                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,212,170,0.08)', color: 'var(--accent)' }}>
                                            {gf.deviceName}
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                            All devices
                                        </span>
                                    )}
                                </div>
                                {gf.description && (
                                    <div style={{ marginTop: '4px', marginLeft: '20px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        {gf.description}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ─── Right panel: Create form ──────────────────────────────── */}
            {showForm && pickLat !== null && pickLng !== null && (
                <div
                    className="glass-panel animate-slide-right"
                    style={{
                        position: 'absolute', top: 16, right: 16,
                        width: 300, padding: '0',
                        zIndex: 1000, overflow: 'hidden',
                    }}
                >
                    {/* Form header */}
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                            New Geofence
                        </h3>
                        <button
                            onClick={resetForm}
                            style={{ width: 26, height: 26, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Position badge */}
                        <div style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Dropped pin</span>
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{pickLat.toFixed(5)}, {pickLng.toFixed(5)}</span>
                        </div>

                        {formError && (
                            <div style={{ padding: '7px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: '12px' }}>
                                {formError}
                            </div>
                        )}

                        {/* Name */}
                        <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                Zone Name *
                            </label>
                            <input
                                type="text"
                                value={fenceName}
                                onChange={e => setFenceName(e.target.value)}
                                className="sx-input"
                                placeholder="e.g. Office Zone, Warehouse"
                                style={{ marginTop: '4px', fontSize: '13px', padding: '8px 12px', width: '100%' }}
                                autoFocus
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                Notes (optional)
                            </label>
                            <input
                                type="text"
                                value={fenceDesc}
                                onChange={e => setFenceDesc(e.target.value)}
                                className="sx-input"
                                placeholder="Brief description..."
                                style={{ marginTop: '4px', fontSize: '13px', padding: '8px 12px', width: '100%' }}
                            />
                        </div>

                        {/* Radius slider */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                    Radius
                                </label>
                                <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700 }}>{fenceRadius >= 1000 ? `${(fenceRadius / 1000).toFixed(1)}km` : `${fenceRadius}m`}</span>
                            </div>
                            <input
                                type="range" min={100} max={20000} step={100}
                                value={fenceRadius}
                                onChange={e => setFenceRadius(Number(e.target.value))}
                                style={{ width: '100%', accentColor: fenceColor }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                <span>100m</span><span>20km</span>
                            </div>
                        </div>

                        {/* Alarm type */}
                        <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                Trigger Alert On
                            </label>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                {(['in', 'out', 'in,out'] as AlarmType[]).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFenceAlarm(type)}
                                        style={{
                                            flex: 1, padding: '7px 0', fontSize: '11px', fontWeight: 600,
                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px solid',
                                            borderColor: fenceAlarm === type ? fenceColor : 'var(--border)',
                                            background: fenceAlarm === type ? `${fenceColor}22` : 'transparent',
                                            color: fenceAlarm === type ? fenceColor : 'var(--text-muted)',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {type === 'in,out' ? '↕ Both' : type === 'in' ? '↘ Enter' : '↗ Exit'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Device (optional) */}
                        <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                Device (optional)
                            </label>
                            <select
                                value={fenceImei}
                                onChange={e => setFenceImei(e.target.value)}
                                className="sx-select"
                                style={{ marginTop: '4px', fontSize: '13px', padding: '8px 12px', width: '100%' }}
                            >
                                <option value="">All devices</option>
                                {devices.map((d: Device) => (
                                    <option key={d.imei} value={d.imei}>{d.deviceName} ({d.imei?.slice(-6)})</option>
                                ))}
                            </select>
                        </div>

                        {/* Color picker */}
                        <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                Zone Color
                            </label>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                                {FENCE_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setFenceColor(c)}
                                        title={c}
                                        style={{
                                            width: 26, height: 26, borderRadius: '50%', border: `3px solid ${fenceColor === c ? '#fff' : 'transparent'}`,
                                            background: c, cursor: 'pointer',
                                            boxShadow: fenceColor === c ? `0 0 0 2px ${c}` : 'none',
                                            transition: 'all 0.15s',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Create button */}
                        <button
                            onClick={handleCreate}
                            disabled={saving || !fenceName.trim()}
                            style={{
                                width: '100%', padding: '10px', borderRadius: 'var(--radius-md)',
                                border: 'none', cursor: saving || !fenceName.trim() ? 'not-allowed' : 'pointer',
                                background: fenceName.trim() ? fenceColor : 'rgba(255,255,255,0.08)',
                                color: fenceName.trim() ? '#000' : 'var(--text-muted)',
                                fontWeight: 700, fontSize: '13px',
                                opacity: saving ? 0.7 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            {saving ? 'Saving...' : '+ Create Geofence'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
