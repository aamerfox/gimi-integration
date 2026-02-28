import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import { gimiService } from '../services/gimi';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapZoomControls from '../components/MapZoomControls';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

interface TrackPoint {
    lat: number;
    lng: number;
    speed: number;
    gpsTime: string;
    direction: number;
}

export default function History() {
    const { accessToken } = useAuthStore();
    const { devices } = useDeviceStore();
    const [selectedImei, setSelectedImei] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [track, setTrack] = useState<TrackPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Playback
    const [playing, setPlaying] = useState(false);
    const [playbackIndex, setPlaybackIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const playIntervalRef = useRef<number | null>(null);

    // Map
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const markerRef = useRef<L.Marker | null>(null);

    // Set default dates
    useEffect(() => {
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        setStartTime(dayAgo.toISOString().slice(0, 16));
        setEndTime(now.toISOString().slice(0, 16));
    }, []);

    // Init map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, {
            center: [24.7136, 46.6753],
            zoom: 6,
            zoomControl: false,
        });
        L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);
        mapRef.current = map;

        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        resizeObserver.observe(containerRef.current);

        // Force tile reload after container is measured
        setTimeout(() => map.invalidateSize(), 100);
        return () => {
            resizeObserver.disconnect();
            map.remove();
            mapRef.current = null;
        };
    }, []);

    const loadTrack = useCallback(async () => {
        if (!accessToken || !selectedImei || !startTime || !endTime) return;
        setLoading(true);
        setError(null);
        setTrack([]);
        setPlaybackIndex(0);
        setPlaying(false);

        try {
            const sTime = startTime.replace('T', ' ') + ':00';
            const eTime = endTime.replace('T', ' ') + ':00';
            const res = await gimiService.getTrackHistory(accessToken, selectedImei, sTime, eTime) as unknown as { result: TrackPoint[] | null };
            if (res?.result && Array.isArray(res.result)) {
                const points: TrackPoint[] = res.result.map((p) => ({
                    lat: p.lat,
                    lng: p.lng,
                    speed: p.speed || 0,
                    gpsTime: p.gpsTime || '',
                    direction: p.direction || 0,
                }));
                setTrack(points);
                drawTrack(points);
            } else {
                setError('No track data found for this period');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load track');
        } finally {
            setLoading(false);
        }
    }, [accessToken, selectedImei, startTime, endTime]);

    const getSpeedColor = (speed: number) => {
        if (speed <= 0) return '#6b7280';
        if (speed < 30) return '#22c55e';
        if (speed < 60) return '#00d4aa';
        if (speed < 90) return '#f59e0b';
        return '#ef4444';
    };

    const drawTrack = (points: TrackPoint[]) => {
        const map = mapRef.current;
        if (!map || points.length === 0) return;

        // Clear previous
        if (polylineRef.current) polylineRef.current.remove();
        if (markerRef.current) markerRef.current.remove();

        // Draw colored polyline segments
        const latLngs: L.LatLngExpression[] = points.map(p => [p.lat, p.lng]);

        // Main polyline
        polylineRef.current = L.polyline(latLngs, {
            color: 'var(--accent)',
            weight: 3,
            opacity: 0.8,
        }).addTo(map);

        // Start marker
        L.circleMarker([points[0].lat, points[0].lng], {
            radius: 6,
            fillColor: '#22c55e',
            fillOpacity: 1,
            color: '#fff',
            weight: 2,
        }).addTo(map).bindPopup(`<strong>Start</strong><br/>${points[0].gpsTime}`);

        // End marker
        const last = points[points.length - 1];
        L.circleMarker([last.lat, last.lng], {
            radius: 6,
            fillColor: '#ef4444',
            fillOpacity: 1,
            color: '#fff',
            weight: 2,
        }).addTo(map).bindPopup(`<strong>End</strong><br/>${last.gpsTime}`);

        // Playback marker
        const playIcon = L.divIcon({
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            html: `<div style="width:24px;height:24px;border-radius:50%;background:var(--accent);border:3px solid #fff;box-shadow:0 0 12px rgba(0,212,170,0.5)"></div>`,
        });
        markerRef.current = L.marker([points[0].lat, points[0].lng], { icon: playIcon }).addTo(map);

        map.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
    };

    // Playback controls
    useEffect(() => {
        if (playing && track.length > 0) {
            playIntervalRef.current = window.setInterval(() => {
                setPlaybackIndex(prev => {
                    if (prev >= track.length - 1) {
                        setPlaying(false);
                        return prev;
                    }
                    const next = prev + 1;
                    if (markerRef.current) {
                        markerRef.current.setLatLng([track[next].lat, track[next].lng]);
                    }
                    return next;
                });
            }, 500 / playbackSpeed);
        }
        return () => {
            if (playIntervalRef.current) clearInterval(playIntervalRef.current);
        };
    }, [playing, playbackSpeed, track]);

    const currentPoint = track[playbackIndex];

    return (
        <div style={{ position: 'relative', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Map */}
            <div ref={containerRef} style={{ flex: 1, minHeight: 0, height: '100%' }} />
            <MapZoomControls mapRef={mapRef as React.RefObject<any>} style={{ position: 'absolute', bottom: track.length > 0 ? '84px' : '24px', right: '16px' }} />

            {/* Floating controls - top left */}
            <div
                className="glass-panel animate-slide-left"
                style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    width: 340,
                    padding: '16px',
                    zIndex: 1000,
                }}
            >
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    Track History
                </h3>

                <select
                    value={selectedImei}
                    onChange={(e) => setSelectedImei(e.target.value)}
                    className="sx-select"
                    style={{ marginBottom: '8px' }}
                >
                    <option value="">Select device...</option>
                    {devices.map((d: Device) => (
                        <option key={d.imei} value={d.imei}>{d.deviceName} ({d.imei})</option>
                    ))}
                </select>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>From</label>
                        <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="sx-input" style={{ fontSize: '12px', padding: '6px 8px', marginTop: '4px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>To</label>
                        <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="sx-input" style={{ fontSize: '12px', padding: '6px 8px', marginTop: '4px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                </div>

                <button
                    onClick={loadTrack}
                    disabled={loading || !selectedImei}
                    className="sx-btn sx-btn-primary sx-btn-sm"
                    style={{ width: '100%' }}
                >
                    {loading ? 'Loading...' : `Load Track`}
                </button>

                {error && (
                    <div style={{ marginTop: '8px', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: '12px' }}>
                        {error}
                    </div>
                )}

                {track.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {track.length} points loaded
                    </div>
                )}
            </div>

            {/* Playback bar - bottom */}
            {track.length > 0 && (
                <div
                    className="glass-panel animate-slide-up"
                    style={{
                        position: 'absolute',
                        bottom: 16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 'min(600px, calc(100% - 32px))',
                        padding: '12px 16px',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    }}
                >
                    {/* Play/Pause */}
                    <button
                        onClick={() => {
                            if (playbackIndex >= track.length - 1) setPlaybackIndex(0);
                            setPlaying(!playing);
                        }}
                        className="sx-btn-icon"
                        style={{ width: 36, height: 36, flexShrink: 0 }}
                    >
                        {playing ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        )}
                    </button>

                    {/* Progress slider */}
                    <input
                        type="range"
                        min={0}
                        max={track.length - 1}
                        value={playbackIndex}
                        onChange={(e) => {
                            const idx = parseInt(e.target.value);
                            setPlaybackIndex(idx);
                            if (markerRef.current) markerRef.current.setLatLng([track[idx].lat, track[idx].lng]);
                        }}
                        style={{ flex: 1, accentColor: 'var(--accent)' }}
                    />

                    {/* Speed selector */}
                    <select
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                        className="sx-select"
                        style={{ width: '70px', padding: '4px 8px', fontSize: '12px' }}
                    >
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={5}>5x</option>
                        <option value={10}>10x</option>
                    </select>

                    {/* Current point info */}
                    {currentPoint && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            <span style={{ color: getSpeedColor(currentPoint.speed) }}>{currentPoint.speed} km/h</span>
                            {' · '}
                            {currentPoint.gpsTime?.split(' ')[1] || ''}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
