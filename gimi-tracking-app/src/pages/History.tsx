import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import { gimiService } from '../services/gimi';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapZoomControls from '../components/MapZoomControls';
import { useTranslation } from 'react-i18next';
import { formatGimiTime, formatGimiTimeOnly, getLocalIsoString, formatToLocalApiTime } from '../utils/time';

const GOOGLE_STREET_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const GOOGLE_STREET_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';
const GOOGLE_SATELLITE_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
const GOOGLE_SATELLITE_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';
const GOOGLE_HYBRID_URL = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
const GOOGLE_HYBRID_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';

interface TrackPoint {
    lat: number;
    lng: number;
    speed: number;
    gpsTime: string;
    direction: number;
    accStatus?: string;
    posType?: string;
    confidence?: number;
}

interface StopPoint {
    lat: number;
    lng: number;
    startTime: string;
    endTime: string;
    durationMs: number;
    address?: string;
}

/**
 * Haversine formula — returns distance in metres between two lat/lng points.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in metres
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function History() {
    const { accessToken, userId: account } = useAuthStore();
    const { devices } = useDeviceStore();
    const [searchParams] = useSearchParams();
    const urlImei = searchParams.get('imei');
    const [selectedImei, setSelectedImei] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [track, setTrack] = useState<TrackPoint[]>([]);
    const [rawTrack, setRawTrack] = useState<TrackPoint[]>([]);
    const [positionMode, setPositionMode] = useState<'all' | 'optimized' | 'precise'>('all');
    const [stops, setStops] = useState<StopPoint[]>([]);
    const [apiStops, setApiStops] = useState<StopPoint[]>([]);
    const [parkingThreshold, setParkingThreshold] = useState<number>(3);
    const [activeTab, setActiveTab] = useState<'points' | 'stops'>('points');
    const [averageSpeed, setAverageSpeed] = useState(0);
    const [totalDistance, setTotalDistance] = useState(0);
    const [apiMileage, setApiMileage] = useState(0);
    const [showPointsList, setShowPointsList] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();

    // Auto-select device from query parameter on mount/devices load
    useEffect(() => {
        if (urlImei && devices.length > 0) {
            const devExists = devices.some(d => d.imei === urlImei);
            if (devExists) {
                setSelectedImei(urlImei);
            }
        }
    }, [urlImei, devices]);

    // Playback
    const [playing, setPlaying] = useState(false);
    const [playbackIndex, setPlaybackIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isMinimized, setIsMinimized] = useState(false);
    const playIntervalRef = useRef<number | null>(null);

    // Map
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const layersGroupRef = useRef<L.LayerGroup | null>(null);

    const filterTrackPoints = useCallback((points: TrackPoint[], mode: 'all' | 'optimized' | 'precise') => {
        if (points.length === 0) return [];
        if (mode === 'all') return points;

        const filtered: TrackPoint[] = [];
        const MAX_SPEED_KMH = mode === 'precise' ? 100 : 150;

        let prevPoint: TrackPoint | null = null;
        let prevMs = 0;

        for (const pt of points) {
            if (!pt || pt.lat === undefined || pt.lng === undefined) continue;
            const lat = Number(pt.lat);
            const lng = Number(pt.lng);
            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

            // Filter by confidence if present (common for smart tags/IoT devices)
            if (pt.confidence !== undefined) {
                if (mode === 'precise' && pt.confidence < 3) {
                    continue;
                }
                if (mode === 'optimized' && pt.confidence < 2) {
                    continue;
                }
            }

            if (mode === 'precise') {
                const posType = (typeof pt.posType === 'string' ? pt.posType : String(pt.posType || '')).toUpperCase();
                const isGps = 
                    posType.includes('GPS') || 
                    posType.includes('BDS') || 
                    posType.includes('GLONASS') || 
                    posType.includes('GLO') || 
                    posType.includes('GALILEO') || 
                    posType.includes('GNSS') || 
                    posType === '0' || 
                    posType === '4' || 
                    posType === '5' || 
                    posType === '6';
                if (!isGps) {
                    continue;
                }
            }

            const s = pt.gpsTime || '';
            const currMs = s
                ? (() => { const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z')); return isNaN(d.getTime()) ? 0 : d.getTime(); })()
                : 0;

            if (prevPoint) {
                const distM = haversineDistance(prevPoint.lat, prevPoint.lng, lat, lng);
                const timeSec = currMs > 0 && prevMs > 0 ? (currMs - prevMs) / 1000 : 0;
                const speedKmh = timeSec > 0 ? (distM / timeSec) * 3.6 : 0;

                if (timeSec > 0 && speedKmh > MAX_SPEED_KMH) {
                    continue;
                }
            }

            filtered.push(pt);
            prevPoint = pt;
            prevMs = currMs;
        }

        return filtered;
    }, []);

    // Set default dates
    useEffect(() => {
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        setStartTime(getLocalIsoString(dayAgo));
        setEndTime(getLocalIsoString(now));
    }, []);

    // Init map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const streetLayer = L.tileLayer(GOOGLE_STREET_URL, { attribution: GOOGLE_STREET_ATTR, maxZoom: 18 });
        const satelliteLayer = L.tileLayer(GOOGLE_SATELLITE_URL, { attribution: GOOGLE_SATELLITE_ATTR, maxZoom: 18 });
        const hybridLayer = L.tileLayer(GOOGLE_HYBRID_URL, { attribution: GOOGLE_HYBRID_ATTR, maxZoom: 18 });

        const baseMaps = {
            "Google Streets": streetLayer,
            "Google Satellite": satelliteLayer,
            "Google Hybrid": hybridLayer
        };

        const map = L.map(containerRef.current, {
            center: [24.7136, 46.6753],
            zoom: 6,
            zoomControl: false,
            attributionControl: false,
            layers: [streetLayer] // Default to street
        });

        L.control.attribution({ prefix: false }).addTo(map);

        const isRtl = document.documentElement.dir === 'rtl';
        L.control.layers(baseMaps, undefined, { position: isRtl ? 'bottomleft' : 'bottomright' }).addTo(map);
        mapRef.current = map;

        // Initialize LayerGroup
        layersGroupRef.current = L.layerGroup().addTo(map);

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

    const drawTrack = useCallback((points: TrackPoint[], activeStops: StopPoint[]) => {
        const map = mapRef.current;
        if (!map) return;

        // Clear previous layers/markers
        if (layersGroupRef.current) {
            layersGroupRef.current.clearLayers();
        } else {
            layersGroupRef.current = L.layerGroup().addTo(map);
        }

        if (points.length === 0) {
            polylineRef.current = null;
            markerRef.current = null;
            return;
        }

        const lg = layersGroupRef.current;

        // Draw colored polyline segments
        const latLngs: L.LatLngExpression[] = points.map(p => [p.lat, p.lng]);

        // Main polyline
        polylineRef.current = L.polyline(latLngs, {
            color: 'var(--accent)',
            weight: 4,
            opacity: 0.85,
        }).addTo(lg);

        // Start marker
        L.circleMarker([points[0].lat, points[0].lng], {
            radius: 7,
            fillColor: '#22c55e',
            fillOpacity: 1,
            color: '#fff',
            weight: 2,
        }).addTo(lg).bindPopup(`<strong>${t('history.startPoint')}</strong><br/>${formatGimiTime(points[0].gpsTime)}`);

        // End marker
        const last = points[points.length - 1];
        L.circleMarker([last.lat, last.lng], {
            radius: 7,
            fillColor: '#ef4444',
            fillOpacity: 1,
            color: '#fff',
            weight: 2,
        }).addTo(lg).bindPopup(`<strong>${t('history.endPoint')}</strong><br/>${formatGimiTime(last.gpsTime)}`);

        // Draw Stop Markers
        activeStops.forEach((s, sIdx) => {
            const stopIcon = L.divIcon({
                className: '',
                iconSize: [22, 22],
                iconAnchor: [11, 11],
                html: `<div style="
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: #f59e0b;
                    border: 3px solid #fff;
                    box-shadow: 0 0 12px rgba(245,158,11,0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    font-family: system-ui, -apple-system, sans-serif;
                    font-size: 10px;
                    font-weight: bold;
                    cursor: pointer;
                ">P</div>`
            });

            L.marker([s.lat, s.lng], { icon: stopIcon })
                .addTo(lg)
                .bindPopup(`
                    <b>${t('history.stop')} #${sIdx + 1}</b><br>
                    <b>${t('history.duration')}:</b> ${formatDuration(s.durationMs, t)}<br>
                    <b>${t('history.time')}:</b> ${formatGimiTime(s.startTime)}<br>${t('history.toLabel')} ${formatGimiTime(s.endTime)}
                    ${s.address ? `<br/><b>${t('history.address')}:</b> ${s.address}` : ''}
                `);
        });

        // Playback marker
        const playIcon = L.divIcon({
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            html: `<div style="width:24px;height:24px;border-radius:50%;background:var(--accent);border:3px solid #fff;box-shadow:0 0 12px rgba(0,212,170,0.5)"></div>`,
        });
        markerRef.current = L.marker([points[0].lat, points[0].lng], { icon: playIcon }).addTo(lg);

        map.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
    }, [t]);

    // Filter track and stops dynamically client-side when threshold or mode changes
    useEffect(() => {
        if (rawTrack.length === 0) {
            setTrack([]);
            setStops([]);
            setTotalDistance(0);
            setAverageSpeed(0);
            return;
        }

        // 1. Filter track points based on positioning mode
        const filteredPoints = filterTrackPoints(rawTrack, positionMode);
        setTrack(filteredPoints);

        // 2. Recalculate distance based on filtered points
        let distKm = 0;
        if (positionMode === 'all' && apiMileage > 0) {
            distKm = apiMileage;
        } else {
            let distMeters = 0;
            let prevPoint: TrackPoint | null = null;
            for (const pt of filteredPoints) {
                if (prevPoint) {
                    distMeters += haversineDistance(prevPoint.lat, prevPoint.lng, pt.lat, pt.lng);
                }
                prevPoint = pt;
            }
            distKm = distMeters / 1000;
        }
        setTotalDistance(distKm);

        // 3. Recalculate average speed based on filtered points (with fallback for tags/devices without active speed data)
        let avgSpd = 0;
        const movingPoints = filteredPoints.filter(p => p.speed > 0);
        if (movingPoints.length > 0) {
            avgSpd = movingPoints.reduce((acc, p) => acc + p.speed, 0) / movingPoints.length;
        } else if (filteredPoints.length >= 2 && distKm > 0) {
            const firstPt = filteredPoints[0];
            const lastPt = filteredPoints[filteredPoints.length - 1];
            const firstMs = new Date(firstPt.gpsTime.replace(' ', 'T') + (firstPt.gpsTime.endsWith('Z') ? '' : 'Z')).getTime();
            const lastMs = new Date(lastPt.gpsTime.replace(' ', 'T') + (lastPt.gpsTime.endsWith('Z') ? '' : 'Z')).getTime();
            const durationHours = (lastMs - firstMs) / (1000 * 60 * 60);
            if (durationHours > 0) {
                avgSpd = distKm / durationHours;
            }
        }
        setAverageSpeed(avgSpd);

        // 3. Filter stops based on parking threshold
        const filteredStops = apiStops.filter(s => (s.durationMs / 60000) >= parkingThreshold);
        setStops(filteredStops);

        // 4. Draw track on map
        drawTrack(filteredPoints, filteredStops);
    }, [rawTrack, positionMode, parkingThreshold, apiStops, apiMileage, filterTrackPoints, drawTrack]);

    const loadTrack = useCallback(async () => {
        if (!accessToken || !selectedImei || !startTime || !endTime) return;
        setLoading(true);
        setError(null);
        setTrack([]);
        setRawTrack([]);
        setStops([]);
        setApiStops([]);
        setTotalDistance(0);
        setApiMileage(0);
        setAverageSpeed(0);
        setPlaybackIndex(0);
        setPlaying(false);

        try {
            const sTime = formatToLocalApiTime(startTime);
            const eTime = formatToLocalApiTime(endTime);

            // Query track points, stops (parking), and mileage in parallel
            const [resTrack, resStops, resMileage] = await Promise.all([
                gimiService.getTrackHistory(accessToken, selectedImei, sTime, eTime),
                gimiService.getParkingReport(accessToken, account || '', selectedImei, sTime, eTime, 'off'),
                gimiService.getTrackMileage(accessToken, selectedImei, sTime, eTime).catch(e => {
                    console.error('Failed to fetch mileage for history page:', e);
                    return null;
                })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ]) as any[];

            if (resTrack?.result && Array.isArray(resTrack.result) && resTrack.result.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const points: TrackPoint[] = resTrack.result.map((p: any) => ({
                    lat: p.lat,
                    lng: p.lng,
                    speed: p.gpsSpeed !== undefined ? p.gpsSpeed : (p.speed || 0),
                    gpsTime: p.gpsTime || '',
                    direction: p.direction || 0,
                    accStatus: p.accStatus !== undefined ? String(p.accStatus) : (p.acc !== undefined ? String(p.acc) : (p.ignition !== undefined ? String(p.ignition) : undefined)),
                    posType: String(p.posType || p.positionType || 'GPS'),
                    confidence: p.confidence !== undefined ? Number(p.confidence) : undefined
                }));

                // Parse Stops returned from Tracksolid API
                const stopRows = resStops?.data?.rows || (Array.isArray(resStops?.result) ? resStops.result : (resStops?.result?.list || []));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const parsedStops: StopPoint[] = stopRows.map((s: any) => ({
                    lat: s.lat,
                    lng: s.lng,
                    startTime: s.startTime || s.start_time || '',
                    endTime: s.endTime || s.end_time || '',
                    durationMs: Number(s.durSecond || s.dur_second || 0) * 1000,
                    address: s.addr || s.address || ''
                }));

                // Parse Mileage returned from Tracksolid API (which is in meters, convert to km)
                let mileageVal = 0;
                if (resMileage) {
                    if (Array.isArray(resMileage.result) && resMileage.result.length > 0) {
                        mileageVal = resMileage.result[0].mileage;
                    } else if (resMileage.result?.mileage !== undefined) {
                        mileageVal = resMileage.result.mileage;
                    } else if (resMileage.data && Array.isArray(resMileage.data) && resMileage.data.length > 0) {
                        mileageVal = resMileage.data[0].mileage;
                    }
                }
                const mileageKm = Number(mileageVal || 0) / 1000;

                setApiStops(parsedStops);
                setApiMileage(mileageKm);
                setRawTrack(points);

                if (window.innerWidth < 768) {
                    setIsMinimized(true);
                }
            } else {
                setError(t('history.noTrackData') || 'No track data found for this period');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : (t('history.failedToLoad') || 'Failed to load track'));
        } finally {
            setLoading(false);
        }
    }, [accessToken, account, selectedImei, startTime, endTime, t]);

    const getSpeedColor = (speed: number) => {
        if (speed <= 0) return '#6b7280';
        if (speed < 30) return '#22c55e';
        if (speed < 60) return '#00d4aa';
        if (speed < 90) return '#f59e0b';
        return '#ef4444';
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
                    if (mapRef.current) {
                        mapRef.current.panTo([track[next].lat, track[next].lng]);
                    }
                    return next;
                });
            }, 500 / playbackSpeed);
        }
        return () => {
            if (playIntervalRef.current) clearInterval(playIntervalRef.current);
        };
    }, [playing, playbackSpeed, track]);

    const handleRowClick = (index: number) => {
        setPlaybackIndex(index);
        const pt = track[index];
        if (markerRef.current) {
            markerRef.current.setLatLng([pt.lat, pt.lng]);
        }
        if (mapRef.current) {
            mapRef.current.panTo([pt.lat, pt.lng]);
        }
    };

    const currentPoint = track[playbackIndex];

    return (
        <div style={{ position: 'relative', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', '--layers-bottom': track.length > 0 ? '170px' : '110px' } as React.CSSProperties}>
            {/* Map Area */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div ref={containerRef} style={{ flex: 1, minHeight: 0, height: '100%', width: '100%' }} />
                <MapZoomControls mapRef={mapRef as unknown as React.RefObject<L.Map>} style={{ position: 'absolute', bottom: track.length > 0 ? '84px' : '24px', insetInlineEnd: 16, zIndex: 999 }} />

                {/* Floating controls - top left */}
                <div
                    className="glass-panel animate-slide-left"
                    ref={(el) => {
                        // Prevent Leaflet from capturing touch/click events inside this panel
                        // Without this, mobile users cannot interact with inputs inside the map overlay
                        if (el && mapRef.current) {
                            L.DomEvent.disableClickPropagation(el);
                            L.DomEvent.disableScrollPropagation(el);
                        }
                    }}
                    style={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        width: 340,
                        padding: '16px',
                        zIndex: 999,
                        maxHeight: 'calc(100vh - 120px)',
                        overflowY: 'auto',
                        touchAction: 'pan-y',  // allow vertical scroll inside panel
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMinimized ? '0px' : '12px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {isMinimized && track.length > 0 && devices.find(d => d.imei === selectedImei)
                                    ? `${devices.find(d => d.imei === selectedImei)?.deviceName} (${totalDistance.toFixed(1)} km)`
                                    : t('nav.history')}
                            </span>
                        </h3>
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                            title={isMinimized ? t('common.maximize') : t('common.minimize')}
                            aria-label={isMinimized ? "Maximize" : "Minimize"}
                        >
                            {isMinimized ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                            )}
                        </button>
                    </div>

                    {!isMinimized && (
                        <>
                            <select
                                value={selectedImei}
                                onChange={(e) => setSelectedImei(e.target.value)}
                                className="sx-select"
                                style={{ marginBottom: '8px' }}
                            >
                                <option value="">{t('common.selectDevice') || 'Select device...'}</option>
                                {devices.map((d: Device) => (
                                    <option key={d.imei} value={d.imei}>{d.deviceName} ({d.imei})</option>
                                ))}
                            </select>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>{t('history.from')}</label>
                                    <input
                                        type="datetime-local"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="sx-input"
                                        style={{
                                            fontSize: '12px', padding: '6px 8px', marginTop: '4px',
                                            width: '100%', boxSizing: 'border-box',
                                            touchAction: 'manipulation',  // instant tap response on mobile
                                            WebkitAppearance: 'none',
                                            cursor: 'pointer',
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>{t('history.to')}</label>
                                    <input
                                        type="datetime-local"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="sx-input"
                                        style={{
                                            fontSize: '12px', padding: '6px 8px', marginTop: '4px',
                                            width: '100%', boxSizing: 'border-box',
                                            touchAction: 'manipulation',
                                            WebkitAppearance: 'none',
                                            cursor: 'pointer',
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>{t('history.parkingTime')}</label>
                                    <select
                                        value={parkingThreshold}
                                        onChange={(e) => setParkingThreshold(Number(e.target.value))}
                                        className="sx-select"
                                        style={{ fontSize: '12px', padding: '6px 8px' }}
                                    >
                                        <option value={0}>{t('history.parkingTimeOptions.all')}</option>
                                        <option value={1}>{t('history.parkingTimeOptions.1min')}</option>
                                        <option value={3}>{t('history.parkingTimeOptions.3min')}</option>
                                        <option value={5}>{t('history.parkingTimeOptions.5min')}</option>
                                        <option value={10}>{t('history.parkingTimeOptions.10min')}</option>
                                        <option value={30}>{t('history.parkingTimeOptions.30min')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>{t('history.positionMode')}</label>
                                    <select
                                        value={positionMode}
                                        onChange={(e) => setPositionMode(e.target.value as any)}
                                        className="sx-select"
                                        style={{ fontSize: '12px', padding: '6px 8px' }}
                                    >
                                        <option value="precise">{t('history.positionModeOptions.precise')}</option>
                                        <option value="optimized">{t('history.positionModeOptions.optimized')}</option>
                                        <option value="all">{t('history.positionModeOptions.all')}</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={loadTrack}
                                disabled={loading || !selectedImei}
                                className="sx-btn sx-btn-primary sx-btn-sm"
                                style={{ width: '100%' }}
                            >
                                {loading ? t('common.loading') : t('history.loadTrack')}
                            </button>

                            {error && (
                                <div style={{ marginTop: '8px', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: '12px' }}>
                                    {error}
                                </div>
                            )}

                            {rawTrack.length > 0 && track.length === 0 && (
                                <div style={{ marginTop: '8px', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: '12px', fontWeight: '500', lineHeight: '1.4' }}>
                                    {t('history.filteredNoDataHint')}
                                </div>
                            )}

                            {/* Left Panel Premium Journey Summary */}
                            {track.length > 0 && (
                                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('history.totalDistance')}</div>
                                            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--accent)' }}>{totalDistance.toFixed(2)} {t('history.distanceUnit') || 'km'}</div>
                                        </div>
                                        <div style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('history.avgSpeed')}</div>
                                            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--warning)' }}>{averageSpeed.toFixed(1)} {t('history.speedUnit') || 'km/h'}</div>
                                        </div>
                                    </div>

                                    {/* Timeline */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                                        <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                                            <div style={{ position: 'absolute', top: '16px', bottom: '16px', left: '5px', width: '2px', borderLeft: '2px dashed var(--border)' }} />
                                            
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', border: '2px solid #fff', marginTop: '4px', flexShrink: 0, zIndex: 1 }} />
                                            <div>
                                                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('history.startPoint')}</div>
                                                <div style={{ fontSize: '11px', fontWeight: '600' }}>{formatGimiTime(track[0].gpsTime)}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{track[0].lat.toFixed(5)}, {track[0].lng.toFixed(5)}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', marginTop: '4px', flexShrink: 0, zIndex: 1 }} />
                                            <div>
                                                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('history.endPoint')}</div>
                                                <div style={{ fontSize: '11px', fontWeight: '600' }}>{formatGimiTime(track[track.length - 1].gpsTime)}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{track[track.length - 1].lat.toFixed(5)}, {track[track.length - 1].lng.toFixed(5)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setShowPointsList(true);
                                        }}
                                        className="sx-btn sx-btn-ghost sx-btn-sm"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                    >
                                        {t('history.viewDetailedTables')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Floating Dashboard Card - top right */}
                {track.length > 0 && (
                    <div
                        className="glass-panel animate-slide-up"
                        style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            zIndex: 999,
                            display: 'flex',
                            gap: '16px',
                            padding: '10px 16px',
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            backdropFilter: 'blur(8px)',
                            alignItems: 'center',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                            <span>{totalDistance.toFixed(2)} {t('history.distanceUnit') || 'km'}</span>
                        </div>
                        <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            <span>{t('history.stopsCount', { count: stops.length })}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Collapsible bottom details table */}
            {showPointsList && track.length > 0 && (
                <div
                    className="glass-panel animate-slide-up"
                    style={{
                        height: '240px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        zIndex: 999,
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => setActiveTab('points')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    color: activeTab === 'points' ? 'var(--accent)' : 'var(--text-secondary)',
                                    borderBottom: activeTab === 'points' ? '2px solid var(--accent)' : 'none',
                                    paddingBottom: '4px'
                                }}
                            >
                                {t('history.playbackPoints')}
                            </button>
                            <button
                                onClick={() => setActiveTab('stops')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    color: activeTab === 'stops' ? 'var(--accent)' : 'var(--text-secondary)',
                                    borderBottom: activeTab === 'stops' ? '2px solid var(--accent)' : 'none',
                                    paddingBottom: '4px'
                                }}
                            >
                                {t('history.stopsList', { count: stops.length })}
                            </button>
                        </div>
                        <button
                            onClick={() => setShowPointsList(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {activeTab === 'points' ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-elevated)', zIndex: 10, borderBottom: '1px solid var(--border)' }}>
                                    <tr>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.pointNo')}</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.positioningTime')}</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.ignition')}</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.coordinates')}</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.speed')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {track.map((item, index) => {
                                        const isIgnitionOn = item.speed > 0 || (item.accStatus && (item.accStatus === '1' || item.accStatus.toUpperCase() === 'ON'));
                                        return (
                                            <tr
                                                key={index}
                                                onClick={() => handleRowClick(index)}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border)',
                                                    backgroundColor: index === playbackIndex ? 'var(--accent-dim)' : 'transparent',
                                                    color: index === playbackIndex ? 'var(--accent)' : 'var(--text-primary)',
                                                    fontWeight: index === playbackIndex ? '700' : 'normal',
                                                }}
                                                className="hover:bg-opacity-10 hover:bg-slate-500"
                                            >
                                                <td style={{ padding: '10px 16px' }}>#{index + 1}</td>
                                                <td style={{ padding: '10px 16px' }}>{formatGimiTime(item.gpsTime)}</td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span className={`badge ${isIgnitionOn ? 'badge-online' : 'badge-offline'}`}>
                                                        {isIgnitionOn ? t('history.on') : t('history.off')}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>
                                                    {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                                                </td>
                                                <td style={{ padding: '10px 16px', fontWeight: '600', color: getSpeedColor(item.speed) }}>
                                                    {item.speed > 0 ? `${item.speed.toFixed(1)} ${t('history.speedUnit') || 'km/h'}` : (t('history.none') || 'None')}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-elevated)', zIndex: 10, borderBottom: '1px solid var(--border)' }}>
                                    <tr>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.pointNo')}</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.startTime')}</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.endTime')}</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.duration')}</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.coordinates')}</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.address')}</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: '600', textAlign: 'center' }}>{t('history.locate')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stops.length > 0 ? (
                                        stops.map((item, index) => (
                                            <tr
                                                key={index}
                                                onClick={() => {
                                                    if (mapRef.current) {
                                                        mapRef.current.panTo([item.lat, item.lng]);
                                                        mapRef.current.setZoom(16);
                                                    }
                                                }}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border)',
                                                    color: 'var(--text-primary)',
                                                }}
                                                className="hover:bg-opacity-10 hover:bg-slate-500"
                                            >
                                                <td style={{ padding: '10px 16px' }}>#{index + 1}</td>
                                                <td style={{ padding: '10px 16px' }}>{formatGimiTime(item.startTime)}</td>
                                                <td style={{ padding: '10px 16px' }}>{formatGimiTime(item.endTime)}</td>
                                                <td style={{ padding: '10px 16px', fontWeight: '600', color: 'var(--warning)' }}>
                                                    {formatDuration(item.durationMs, t)}
                                                </td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>
                                                    {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                                                </td>
                                                <td style={{ padding: '10px 16px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.address || '—'}>
                                                    {item.address || '—'}
                                                </td>
                                                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                                    <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                {t('history.noStops') || 'No stops detected for this period'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Playback bar - bottom */}
            {track.length > 0 && (
                <div
                    className="glass-panel animate-slide-up"
                    style={{
                        position: 'relative',
                        bottom: 0,
                        left: 0,
                        transform: 'none',
                        width: '100%',
                        padding: '12px 16px',
                        zIndex: 999,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        borderTop: '1px solid var(--border)',
                        boxSizing: 'border-box'
                    }}
                >
                    {/* Play/Pause */}
                    <button
                        onClick={() => {
                            if (playbackIndex >= track.length - 1) setPlaybackIndex(0);
                            setPlaying(!playing);
                        }}
                        className="sx-btn-icon"
                        style={{ width: 36, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        {playing ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none" style={{ transform: document.documentElement.dir === 'rtl' ? 'scaleX(-1)' : 'none' }}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none" style={{ transform: document.documentElement.dir === 'rtl' ? 'scaleX(-1)' : 'none' }}><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        )}
                    </button>

                    {/* List Toggle */}
                    <button
                        onClick={() => setShowPointsList(!showPointsList)}
                        className="sx-btn-icon"
                        style={{
                            width: 36,
                            height: 36,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: showPointsList ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                            border: showPointsList ? '1px solid var(--accent)' : '1px solid var(--border)',
                            borderRadius: '50%',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" style={{ margin: 'auto' }}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
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
                            <span style={{ color: getSpeedColor(currentPoint.speed) }}>{currentPoint.speed} {t('history.speedUnit') || 'km/h'}</span>
                            {' · '}
                            {formatGimiTimeOnly(currentPoint.gpsTime)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function formatDuration(ms: number, t: any): string {
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hours > 0) {
        return t('history.durationFormat.hoursMins', { hours, mins });
    }
    if (mins > 0) {
        return t('history.durationFormat.mins', { mins });
    }
    return t('history.durationFormat.secs', { secs });
}
