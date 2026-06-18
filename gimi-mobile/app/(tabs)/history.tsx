import { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Platform, FlatList, Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { WebView } from 'react-native-webview';
import { useAuthStore } from '@/store/auth';
import { useDeviceStore, Device } from '@/store/devices';
import { useThemeStore } from '@/store/theme';
import { useTranslation } from 'react-i18next';
import { gimiService } from '@/services/gimi';
import COLORS from '@/constants/Colors';
import { Feather } from '@expo/vector-icons';
import { formatGimiTime, formatGimiTimeOnly } from '@/utils/time';

interface TrackPoint {
    lat: number;
    lng: number;
    speed: number;
    gpsTime: string;
    direction: number;
    posType?: string;
    confidence?: number;
}

interface StopPoint {
    lat: number;
    lng: number;
    startTime: string;
    endTime: string;
    durationMs: number;
}

interface ApiTrackResult {
    result?: TrackPoint[] | null;
}

// Distance between two coordinates in km (Haversine formula)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Calculate cumulative trip distance
function calculateTotalDistance(points: TrackPoint[]): number {
    let total = 0;
    let prevPoint: TrackPoint | null = null;
    for (const pt of points) {
        if (!pt || pt.lat === undefined || pt.lng === undefined) continue;
        const lat = Number(pt.lat);
        const lng = Number(pt.lng);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;
        if (prevPoint) {
            total += getDistance(prevPoint.lat, prevPoint.lng, lat, lng);
        }
        prevPoint = pt;
    }
    return total;
}

// Group stationary coordinates where speed < 2 km/h for >= 3 minutes
function detectStops(points: TrackPoint[], thresholdMinutes = 3): StopPoint[] {
    const stops: StopPoint[] = [];
    if (points.length < 2) return stops;

    let stopStartIdx = -1;
    const thresholdMs = thresholdMinutes * 60 * 1000;

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const isStationary = p.speed < 2;

        if (isStationary) {
            if (stopStartIdx === -1) {
                stopStartIdx = i;
            }
        } else {
            if (stopStartIdx !== -1) {
                const startPoint = points[stopStartIdx];
                const endPoint = points[i - 1];
                const startTimeMs = new Date(startPoint.gpsTime.replace(' ', 'T') + 'Z').getTime();
                const endTimeMs = new Date(p.gpsTime.replace(' ', 'T') + 'Z').getTime();
                const durationMs = endTimeMs - startTimeMs;

                if (durationMs >= thresholdMs) {
                    stops.push({
                        lat: startPoint.lat,
                        lng: startPoint.lng,
                        startTime: startPoint.gpsTime,
                        endTime: endPoint.gpsTime,
                        durationMs,
                    });
                }
                stopStartIdx = -1;
            }
        }
    }

    if (stopStartIdx !== -1) {
        const startPoint = points[stopStartIdx];
        const endPoint = points[points.length - 1];
        const startTimeMs = new Date(startPoint.gpsTime.replace(' ', 'T') + 'Z').getTime();
        const endTimeMs = new Date(endPoint.gpsTime.replace(' ', 'T') + 'Z').getTime();
        const durationMs = endTimeMs - startTimeMs;

        if (durationMs >= thresholdMs) {
            stops.push({
                lat: startPoint.lat,
                lng: startPoint.lng,
                startTime: startPoint.gpsTime,
                endTime: endPoint.gpsTime,
                durationMs,
            });
        }
    }

    return stops;
}

function buildTrackHtml(points: TrackPoint[], theme: 'dark' | 'light', playIdx: number, stops: StopPoint[]): string {
    const bg = theme === 'dark' ? '#0a0e1a' : '#f0f4f8';
    const accent = theme === 'dark' ? '#0891b2' : '#1e3a8a';
    const lineColor = accent;

    const pointsJson = JSON.stringify(points.map(p => ({ lat: p.lat, lng: p.lng, speed: p.speed, t: formatGimiTime(p.gpsTime) })));
    const stopsJson = JSON.stringify(stops.map((s, idx) => ({
        lat: s.lat,
        lng: s.lng,
        duration: Math.round(s.durationMs / 60000),
        startT: formatGimiTime(s.startTime),
        endT: formatGimiTime(s.endTime),
        idx: idx + 1
    })));

    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${bg};}
  .leaflet-popup-content-wrapper{background:${theme === 'dark' ? '#1a2035' : '#fff'};color:${theme === 'dark' ? '#f1f5f9' : '#0f172a'};border-radius:12px;border:1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};}
  .leaflet-popup-tip{background:${theme === 'dark' ? '#1a2035' : '#fff'};}
  .leaflet-control-zoom a{background:${theme === 'dark' ? '#111827' : '#fff'} !important;color:${theme === 'dark' ? '#94a3b8' : '#475569'} !important;}
  .stop-marker{width:22px;height:22px;border-radius:50%;background:#f59e0b;border:3px solid #fff;box-shadow:0 0 12px rgba(245,158,11,0.6);display:flex;align-items:center;justify-content:center;color:#fff;font-family:system-ui,-apple-system,sans-serif;font-size:10px;font-weight:bold;cursor:pointer;}
</style>
</head>
<body>
<div id="map"></div>
<script>
var pts = ${pointsJson};
var playIdx = ${playIdx};
var map;
if (pts && pts.length > 0) {
  var activeIdx = Math.max(0, Math.min(playIdx, pts.length - 1));
  map = L.map('map',{center:[pts[0].lat,pts[0].lng],zoom:14,zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:18}).addTo(map);

  // Track polyline
  var line = L.polyline(pts.map(function(p){return [p.lat,p.lng];}), {
    color:'${lineColor}', weight:4, opacity:0.85
  }).addTo(map);
  map.fitBounds(line.getBounds(),{padding:[40,40]});

  // Start marker
  L.circleMarker([pts[0].lat,pts[0].lng],{
    radius:7,fillColor:'#22c55e',fillOpacity:1,color:'#fff',weight:2
  }).addTo(map).bindPopup('<b>Start</b><br>'+pts[0].t);

  // End marker
  var last = pts[pts.length-1];
  L.circleMarker([last.lat,last.lng],{
    radius:7,fillColor:'#ef4444',fillOpacity:1,color:'#fff',weight:2
  }).addTo(map).bindPopup('<b>End</b><br>'+last.t);

  // Draw stop markers
  var stops = ${stopsJson};
  stops.forEach(function(s) {
    var icon = L.divIcon({
      className: '',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      html: '<div class="stop-marker">P</div>'
    });
    L.marker([s.lat, s.lng], {icon: icon})
      .addTo(map)
      .bindPopup('<b>Stop #' + s.idx + '</b><br>' +
                 '<b>Duration:</b> ' + s.duration + ' mins<br>' +
                 '<b>Time:</b> ' + s.startT + '<br>to ' + s.endT);
  });

  // Playback dot
  if (pts[activeIdx]) {
    var playDot = L.circleMarker([pts[activeIdx].lat,pts[activeIdx].lng],{
      radius:10,fillColor:'${accent}',fillOpacity:1,color:'#fff',weight:3
    }).addTo(map);
    playDot.bindPopup('<b>'+pts[activeIdx].speed+' km/h</b><br>'+pts[activeIdx].t);

    // Listen for playback index updates from React
    window.addEventListener('message',function(e){
      try{
        var d=typeof e.data==='string'?JSON.parse(e.data):e.data;
        if(d.type==='setPlay' && pts[d.idx]){
          playDot.setLatLng([pts[d.idx].lat,pts[d.idx].lng]);
          map.panTo([pts[d.idx].lat,pts[d.idx].lng],{animate:true,duration:0.3});
        }
      }catch(err){}
    });
  }
} else {
  map = L.map('map',{center:[24.7136,46.6753],zoom:6,zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:18}).addTo(map);
}
</script>
</body>
</html>`;
}

function filterTrackPoints(points: TrackPoint[], mode: 'all' | 'optimized' | 'precise'): TrackPoint[] {
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
            const distKm = getDistance(prevPoint.lat, prevPoint.lng, lat, lng);
            const timeSec = currMs > 0 && prevMs > 0 ? (currMs - prevMs) / 1000 : 0;
            const speedKmh = timeSec > 0 ? (distKm / (timeSec / 3600)) : 0;

            if (timeSec > 0 && speedKmh > MAX_SPEED_KMH) {
                continue;
            }
        }

        filtered.push(pt);
        prevPoint = pt;
        prevMs = currMs;
    }

    return filtered;
}

// Reusable date-offset helper
function defaultDates(): { start: string; end: string } {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => {
        const tzOffset = d.getTimezoneOffset() * 60 * 1000;
        const localDate = new Date(d.getTime() - tzOffset);
        return localDate.toISOString().slice(0, 16).replace('T', ' ');
    };
    return { start: fmt(dayAgo), end: fmt(now) };
}

export default function HistoryScreen() {
    const { accessToken } = useAuthStore();
    const { devices } = useDeviceStore();
    const { theme } = useThemeStore();
    const { t } = useTranslation();
    const C = COLORS[theme];

    const defaults = defaultDates();
    const [selectedImei, setSelectedImei] = useState('');
    const [startTime, setStartTime] = useState(defaults.start);
    const [endTime, setEndTime] = useState(defaults.end);
    const [track, setTrack] = useState<TrackPoint[]>([]);
    const [rawTrack, setRawTrack] = useState<TrackPoint[]>([]);
    const [positionMode, setPositionMode] = useState<'all' | 'optimized' | 'precise'>('all');
    const [apiMileage, setApiMileage] = useState(0);
    const [stops, setStops] = useState<StopPoint[]>([]);
    const [totalDistance, setTotalDistance] = useState(0);
    const [showPointsList, setShowPointsList] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter track and stops dynamically client-side when rawTrack or mode changes
    useEffect(() => {
        if (rawTrack.length === 0) {
            setTrack([]);
            setStops([]);
            setTotalDistance(0);
            return;
        }

        const filteredPoints = filterTrackPoints(rawTrack, positionMode);
        setTrack(filteredPoints);

        const detectedStops = detectStops(filteredPoints);
        setStops(detectedStops);

        let distanceKm = 0;
        if (positionMode === 'all' && apiMileage > 0) {
            distanceKm = apiMileage;
        } else {
            distanceKm = calculateTotalDistance(filteredPoints);
        }
        setTotalDistance(distanceKm);

        setPlayIdx(prev => {
            if (prev >= filteredPoints.length) {
                return Math.max(0, filteredPoints.length - 1);
            }
            return prev;
        });
    }, [rawTrack, positionMode, apiMileage]);

    // Playback
    const [playing, setPlaying] = useState(false);
    const [playIdx, setPlayIdx] = useState(0);
    const [speed, setSpeed] = useState(1);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [trackHtml, setTrackHtml] = useState('');

    // ─── Date-picker modal state ────────────────────────────────────────────
    const [showPicker, setShowPicker] = useState(false);
    const [editingField, setEditingField] = useState<'start' | 'end'>('start');

    // Decomposed picker wheels
    const parseToObj = (s: string) => {
        const [datePart = '', timePart = '00:00'] = s.split(' ');
        const [y = '2026', m = '06', d = '01'] = datePart.split('-');
        const [h = '00', min = '00'] = timePart.split(':');
        return { y: Number(y), m: Number(m), d: Number(d), h: Number(h), min: Number(min) };
    };
    const [py, setPy] = useState(() => parseToObj(defaults.start).y);
    const [pm, setPm] = useState(() => parseToObj(defaults.start).m);
    const [pd, setPd] = useState(() => parseToObj(defaults.start).d);
    const [ph, setPh] = useState(() => parseToObj(defaults.start).h);
    const [pmin, setPmin] = useState(() => parseToObj(defaults.start).min);

    const openPicker = (field: 'start' | 'end') => {
        const obj = parseToObj(field === 'start' ? startTime : endTime);
        setPy(obj.y); setPm(obj.m); setPd(obj.d); setPh(obj.h); setPmin(obj.min);
        setEditingField(field);
        setShowPicker(true);
    };

    const confirmPicker = () => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const daysInMonth = new Date(py, pm, 0).getDate();
        const clampedDay = Math.min(pd, daysInMonth);
        const formatted = `${py}-${pad(pm)}-${pad(clampedDay)} ${pad(ph)}:${pad(pmin)}`;
        if (editingField === 'start') setStartTime(formatted);
        else setEndTime(formatted);
        setShowPicker(false);
    };

    const years  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const daysInMonth = new Date(py, pm, 0).getDate();
    const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const hours  = Array.from({ length: 24 }, (_, i) => i);
    const mins   = Array.from({ length: 60 }, (_, i) => i);
    // ────────────────────────────────────────────────────────────────────────

    // Update track HTML whenever track, theme, or stops change
    useEffect(() => {
        if (track.length > 0) setTrackHtml(buildTrackHtml(track, theme, playIdx, stops));
    }, [track, theme, stops]);

    // Reference specifically for Android/iOS WebView
    const webViewRef = useRef<WebView>(null);

    // Relay playback index to iframe via postMessage (web) or injectJavaScript (native)
    useEffect(() => {
        if (track.length > 0) {
            const payload = JSON.stringify({ type: 'setPlay', idx: playIdx });
            if (Platform.OS === 'web' && typeof document !== 'undefined' && iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(payload, '*');
            } else if (Platform.OS !== 'web' && webViewRef.current) {
                webViewRef.current.injectJavaScript(`
                    window.dispatchEvent(new MessageEvent('message', {
                        data: ${payload}
                    }));
                    true;
                `);
            }
        }
    }, [playIdx, track]);

    // Playback interval
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (!playing || track.length === 0) return;
        intervalRef.current = setInterval(() => {
            setPlayIdx(prev => {
                const next = prev + 1;
                if (next >= track.length) {
                    setPlaying(false);
                    clearInterval(intervalRef.current!);
                    return track.length - 1;
                }
                return next;
            });
        }, Math.max(50, Math.round(400 / speed)));
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [playing, speed, track.length]);

    const loadTrack = useCallback(async () => {
        if (!accessToken || !selectedImei) return;
        setLoading(true);
        setError(null);
        setTrack([]);
        setRawTrack([]);
        setStops([]);
        setTotalDistance(0);
        setApiMileage(0);
        setPlayIdx(0);
        setPlaying(false);
        try {
            const sTime = startTime.replace('T', ' ') + ':00';
            const eTime = endTime.replace('T', ' ') + ':00';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const [resTrack, resMileage] = await Promise.all([
                gimiService.getTrackHistory(accessToken, selectedImei, sTime, eTime).catch(err => {
                    console.error('Failed to load track history:', err);
                    return null;
                }),
                gimiService.getTrackMileage(accessToken, selectedImei, sTime, eTime).catch(err => {
                    console.error('Failed to load track mileage:', err);
                    return null;
                })
            ]) as any[];

            if (resTrack?.result && Array.isArray(resTrack.result) && resTrack.result.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const pts: TrackPoint[] = resTrack.result.map((p: any) => ({
                    lat: p.lat, lng: p.lng,
                    speed: p.gpsSpeed !== undefined ? p.gpsSpeed : (p.speed || 0),
                    gpsTime: p.gpsTime || '',
                    direction: p.direction || 0,
                    posType: String(p.posType || p.positionType || 'GPS'),
                    confidence: p.confidence !== undefined ? Number(p.confidence) : undefined
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

                setApiMileage(mileageKm);
                setRawTrack(pts);
            } else {
                setError('No track data found for this period');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load track');
        } finally {
            setLoading(false);
        }
    }, [accessToken, selectedImei, startTime, endTime]);

    const getSpeedColor = (s: number) => {
        if (s <= 0) return C.offline;
        if (s < 30) return C.online;
        if (s < 60) return C.accent;
        if (s < 90) return C.warning;
        return C.danger;
    };

    const currentPoint = track[playIdx];

    const s = styles(C);

    return (
        <View style={s.container}>
            {/* ── Controls panel */}
            <View style={s.controls}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Device picker */}
                    <Text style={s.label}>{t('share.device')}</Text>
                    <View style={s.pickerWrap}>
                        <Picker
                            selectedValue={selectedImei}
                            onValueChange={(v) => setSelectedImei(v)}
                            style={s.picker}
                            dropdownIconColor={C.textMuted}
                        >
                            <Picker.Item label={t('common.selectDevice') + '...'} value="" color={C.textMuted} />
                            {devices.map((d: Device) => (
                                <Picker.Item key={d.imei} label={`${d.deviceName}`} value={d.imei} color={C.textPrimary} />
                            ))}
                        </Picker>
                    </View>

                    {/* Positioning Mode Picker */}
                    <Text style={s.label}>{t('history.positionMode')}</Text>
                    <View style={s.pickerWrap}>
                        <Picker
                            selectedValue={positionMode}
                            onValueChange={(v) => setPositionMode(v as 'all' | 'optimized' | 'precise')}
                            style={s.picker}
                            dropdownIconColor={C.textMuted}
                        >
                            <Picker.Item label={t('history.positionModeOptions.precise')} value="precise" color={C.textPrimary} />
                            <Picker.Item label={t('history.positionModeOptions.optimized')} value="optimized" color={C.textPrimary} />
                            <Picker.Item label={t('history.positionModeOptions.all')} value="all" color={C.textPrimary} />
                        </Picker>
                    </View>

                    {/* Date range — tappable to open picker */}
                    <View style={s.dateRow}>
                        <TouchableOpacity style={s.dateField} onPress={() => openPicker('start')} activeOpacity={0.7}>
                            <Text style={s.label}>{t('history.from').toUpperCase()}</Text>
                            <Text style={s.dateText}>{startTime.slice(0, 10)}</Text>
                            <Text style={s.dateTime}>{startTime.slice(11, 16)}</Text>
                            <Feather name="edit-2" size={10} color={C.textMuted} style={{ position: 'absolute', top: 8, right: 8 }} />
                        </TouchableOpacity>
                        <Text style={[s.dateSep, { color: C.textMuted }]}>→</Text>
                        <TouchableOpacity style={s.dateField} onPress={() => openPicker('end')} activeOpacity={0.7}>
                            <Text style={s.label}>{t('history.to').toUpperCase()}</Text>
                            <Text style={s.dateText}>{endTime.slice(0, 10)}</Text>
                            <Text style={s.dateTime}>{endTime.slice(11, 16)}</Text>
                            <Feather name="edit-2" size={10} color={C.textMuted} style={{ position: 'absolute', top: 8, right: 8 }} />
                        </TouchableOpacity>
                    </View>

                    {/* Quick range buttons */}
                    <View style={s.quickRow}>
                        {[
                            { label: '1h', h: 1 },
                            { label: '6h', h: 6 },
                            { label: '24h', h: 24 },
                            { label: '7d', h: 168 },
                        ].map(({ label, h }) => (
                            <TouchableOpacity
                                key={label}
                                style={s.quickBtn}
                                onPress={() => {
                                    const now = new Date();
                                    const ago = new Date(now.getTime() - h * 3600 * 1000);
                                    const fmt = (d: Date) => {
                                        const tzOffset = d.getTimezoneOffset() * 60 * 1000;
                                        const localDate = new Date(d.getTime() - tzOffset);
                                        return localDate.toISOString().slice(0, 16).replace('T', ' ');
                                    };
                                    setStartTime(fmt(ago));
                                    setEndTime(fmt(now));
                                }}
                            >
                                <Text style={s.quickBtnText}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Load button */}
                    <TouchableOpacity
                        style={[s.loadBtn, (!selectedImei || loading) && s.loadBtnDisabled]}
                        onPress={loadTrack}
                        disabled={!selectedImei || loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={s.loadBtnText}><Feather name="search" size={14} color="#fff" /> {t('history.loadTrack')}</Text>
                        }
                    </TouchableOpacity>

                    {error && <Text style={s.errorText}>{error}</Text>}
                    {rawTrack.length > 0 && track.length === 0 && (
                        <Text style={[s.errorText, { color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)', borderWidth: 1, padding: 10, borderRadius: 8, marginTop: 8, overflow: 'hidden' }]}>
                            {t('history.filteredNoDataHint')}
                        </Text>
                    )}
                    {track.length > 0 && (
                        <Text style={s.pointCount}><Feather name="check-circle" size={12} color={C.online} /> {track.length} {t('history.pointsLoaded')}</Text>
                    )}
                </ScrollView>
            </View>

            {/* ── Map */}
            <View style={s.mapWrap}>
                {track.length === 0 ? (
                    <View style={s.mapEmpty}>
                        <Feather name="map" size={48} color={C.textMuted} style={{ marginBottom: 12 }} />
                        <Text style={[s.mapEmptyText, { color: C.textMuted }]}>
                            {loading
                                ? 'Loading track...'
                                : rawTrack.length > 0
                                    ? t('history.filteredNoDataHint')
                                    : 'Select a device and date range, then tap Load Track'}
                        </Text>
                        {loading && <ActivityIndicator color={C.accent} style={{ marginTop: 12 }} />}
                    </View>
                ) : Platform.OS === 'web' ? (
                    // Web: Leaflet iframe
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <iframe
                            ref={(el) => { (iframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = el; }}
                            srcDoc={trackHtml}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                        {/* Floating Dashboard Card */}
                        <div style={{
                            position: 'absolute', top: '12px', right: '12px', zIndex: 100,
                            backgroundColor: C.bgSecondary + 'EE', border: '1px solid ' + C.border,
                            borderRadius: '12px', padding: '10px', display: 'flex', gap: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: C.textPrimary }}>
                                <Feather name="activity" size={14} color={C.accent} /> {totalDistance.toFixed(2)} km
                            </div>
                            <div style={{ width: '1px', backgroundColor: C.border }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: C.textPrimary }}>
                                <Feather name="map-pin" size={14} color="#f59e0b" /> {stops.length} Stops
                            </div>
                        </div>
                    </div>
                ) : (
                    // Native WebView (Android/iOS)
                    <View style={{ flex: 1, position: 'relative' }}>
                        <WebView
                            ref={webViewRef}
                            originWhitelist={['*']}
                            source={{ html: trackHtml }}
                            containerStyle={{ width: '100%', height: '100%' }}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                        />
                        {/* Floating Glassmorphic Stats Card */}
                        <View style={s.floatingInfoCard}>
                            <View style={s.infoRow}>
                                <Feather name="activity" size={14} color={C.accent} />
                                <Text style={s.infoValue}>{totalDistance.toFixed(2)} km</Text>
                            </View>
                            <View style={s.infoSep} />
                            <View style={s.infoRow}>
                                <Feather name="map-pin" size={14} color="#f59e0b" />
                                <Text style={s.infoValue}>{stops.length} Stops</Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            {/* ── Playback bar */}
            {track.length > 0 && (
                <View style={s.playbar}>
                    {/* Play/Pause */}
                    <TouchableOpacity
                        style={s.playBtn}
                        onPress={() => {
                            if (playIdx >= track.length - 1) setPlayIdx(0);
                            setPlaying(p => !p);
                        }}
                    >
                        <Feather name={playing ? 'pause' : 'play'} size={18} color={C.textPrimary} />
                    </TouchableOpacity>

                    {/* Simplified Points Drawer Trigger Button */}
                    <TouchableOpacity
                        style={s.listBtn}
                        onPress={() => setShowPointsList(true)}
                    >
                        <Feather name="list" size={18} color={C.textPrimary} />
                    </TouchableOpacity>

                    {/* Progress info */}
                    <View style={s.progressInfo}>
                        <View style={s.progressBarBg}>
                            <View style={[s.progressBarFill, {
                                width: `${Math.round((playIdx / Math.max(track.length - 1, 1)) * 100)}%`,
                                backgroundColor: C.accent,
                            } as object]} />
                        </View>
                        {currentPoint && (
                            <View style={s.playStats}>
                                <Text style={[s.playSpeed, { color: getSpeedColor(currentPoint.speed) }]}>
                                    {currentPoint.speed} km/h
                                </Text>
                                <Text style={s.playTime}>
                                    {formatGimiTimeOnly(currentPoint.gpsTime).slice(0, 5)}
                                </Text>
                                <Text style={s.playProgress}>
                                    {playIdx + 1}/{track.length}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Speed selector */}
                    <View style={s.speedWrap}>
                        {[1, 2, 5, 10].map(x => (
                            <TouchableOpacity
                                key={x}
                                style={[s.speedBtn, speed === x && s.speedBtnActive]}
                                onPress={() => setSpeed(x)}
                            >
                                <Text style={[s.speedBtnText, speed === x && { color: C.accent }]}>
                                    {x}x
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* ── Collapsible History Points sheet (Simplified) */}
            {showPointsList && track.length > 0 && (
                <View style={s.drawerOverlay}>
                    <View style={s.drawerContainer}>
                        {/* Header */}
                        <View style={s.drawerHeader}>
                            <Text style={s.drawerTitle}>{t('tabs.history')}</Text>
                            <TouchableOpacity
                                style={s.drawerCloseBtn}
                                onPress={() => setShowPointsList(false)}
                            >
                                <Feather name="x" size={20} color={C.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {/* Table Header */}
                        <View style={s.tableHeaderRow}>
                            <Text style={[s.colHeader, { width: 50 }]}>No.</Text>
                            <Text style={[s.colHeader, { flex: 1 }]}>Time</Text>
                            <Text style={[s.colHeader, { width: 150 }]}>Coordinates</Text>
                        </View>

                        {/* Highly-optimized FlatList */}
                        <FlatList
                            data={track}
                            keyExtractor={(_, idx) => idx.toString()}
                            renderItem={({ item, index }) => (
                                <TouchableOpacity
                                    style={[s.tableRow, index === playIdx && s.activeTableRow]}
                                    onPress={() => {
                                        setPlayIdx(index);
                                        setShowPointsList(false);
                                    }}
                                >
                                    <Text style={[s.tableCell, { width: 50 }, index === playIdx && s.activeCellText]}>
                                        #{index + 1}
                                    </Text>
                                    <Text style={[s.tableCell, { flex: 1 }, index === playIdx && s.activeCellText]}>
                                        {formatGimiTime(item.gpsTime)}
                                    </Text>
                                    <Text style={[s.tableCell, { width: 150, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }, index === playIdx && s.activeCellText]}>
                                        {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            maxToRenderPerBatch={25}
                            windowSize={10}
                            showsVerticalScrollIndicator={true}
                        />
                    </View>
                </View>
            )}

            {/* ── Date/Time Picker Modal ── */}
            <Modal
                visible={showPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPicker(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={[s.modalSheet, { backgroundColor: C.bgSecondary }]}>
                        {/* Modal header */}
                        <View style={s.modalHeader}>
                            <Text style={[s.modalTitle, { color: C.textPrimary }]}>
                                {editingField === 'start' ? t('history.from') : t('history.to')}
                            </Text>
                            <TouchableOpacity onPress={() => setShowPicker(false)}>
                                <Feather name="x" size={20} color={C.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Picker wheels: Year / Month / Day / Hour / Min */}
                        <View style={s.pickerRow}>
                            <View style={s.pickerCol}>
                                <Text style={[s.pickerColLabel, { color: C.textMuted }]}>Year</Text>
                                <Picker
                                    selectedValue={py}
                                    onValueChange={v => setPy(Number(v))}
                                    style={{ color: C.textPrimary, width: 90 }}
                                    dropdownIconColor={C.textMuted}
                                >
                                    {years.map(y => <Picker.Item key={y} label={String(y)} value={y} color={C.textPrimary} />)}
                                </Picker>
                            </View>
                            <View style={s.pickerCol}>
                                <Text style={[s.pickerColLabel, { color: C.textMuted }]}>Month</Text>
                                <Picker
                                    selectedValue={pm}
                                    onValueChange={v => setPm(Number(v))}
                                    style={{ color: C.textPrimary, width: 80 }}
                                    dropdownIconColor={C.textMuted}
                                >
                                    {months.map(m => <Picker.Item key={m} label={String(m).padStart(2,'0')} value={m} color={C.textPrimary} />)}
                                </Picker>
                            </View>
                            <View style={s.pickerCol}>
                                <Text style={[s.pickerColLabel, { color: C.textMuted }]}>Day</Text>
                                <Picker
                                    selectedValue={pd}
                                    onValueChange={v => setPd(Number(v))}
                                    style={{ color: C.textPrimary, width: 80 }}
                                    dropdownIconColor={C.textMuted}
                                >
                                    {days.map(d => <Picker.Item key={d} label={String(d).padStart(2,'0')} value={d} color={C.textPrimary} />)}
                                </Picker>
                            </View>
                            <View style={s.pickerCol}>
                                <Text style={[s.pickerColLabel, { color: C.textMuted }]}>Hour</Text>
                                <Picker
                                    selectedValue={ph}
                                    onValueChange={v => setPh(Number(v))}
                                    style={{ color: C.textPrimary, width: 80 }}
                                    dropdownIconColor={C.textMuted}
                                >
                                    {hours.map(h => <Picker.Item key={h} label={String(h).padStart(2,'0')} value={h} color={C.textPrimary} />)}
                                </Picker>
                            </View>
                            <View style={s.pickerCol}>
                                <Text style={[s.pickerColLabel, { color: C.textMuted }]}>Min</Text>
                                <Picker
                                    selectedValue={pmin}
                                    onValueChange={v => setPmin(Number(v))}
                                    style={{ color: C.textPrimary, width: 80 }}
                                    dropdownIconColor={C.textMuted}
                                >
                                    {mins.map(m => <Picker.Item key={m} label={String(m).padStart(2,'0')} value={m} color={C.textPrimary} />)}
                                </Picker>
                            </View>
                        </View>

                        {/* Confirm button */}
                        <TouchableOpacity
                            style={[s.confirmBtn, { backgroundColor: C.accent }]}
                            onPress={confirmPicker}
                        >
                            <Text style={s.confirmBtnText}>✓  Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgPrimary },

    controls: {
        backgroundColor: C.bgSecondary,
        borderBottomWidth: 1, borderColor: C.border,
        padding: 12, maxHeight: 320,
    },
    label: {
        fontSize: 10, fontWeight: '700', color: C.textMuted,
        letterSpacing: 1, marginBottom: 4,
    },
    pickerWrap: {
        backgroundColor: C.bgElevated, borderRadius: 10,
        borderWidth: 1, borderColor: C.border, marginBottom: 10,
        overflow: 'hidden',
        height: 52, justifyContent: 'center',
    },
    picker: {
        color: C.textPrimary,
        height: Platform.OS === 'android' ? 52 : 44,
        backgroundColor: 'transparent',
        borderWidth: 0,
    },

    dateRow: {
        flexDirection: 'row', alignItems: 'center',
        gap: 8, marginBottom: 10,
    },
    dateField: { flex: 1, backgroundColor: C.bgElevated, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: C.border },
    dateSep: { fontSize: 16 },
    dateText: { fontSize: 13, fontWeight: '600', color: C.textPrimary },
    dateTime: { fontSize: 11, color: C.textMuted, marginTop: 2 },

    quickRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
    quickBtn: {
        flex: 1, paddingVertical: 6, borderRadius: 8,
        backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border,
        alignItems: 'center',
    },
    quickBtnText: { fontSize: 12, fontWeight: '600', color: C.textSecondary },

    loadBtn: {
        backgroundColor: C.accent, borderRadius: 10, paddingVertical: 12,
        alignItems: 'center', marginBottom: 6,
    },
    loadBtnDisabled: { opacity: 0.5 },
    loadBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    errorText: { color: C.danger, fontSize: 12, textAlign: 'center', marginTop: 4 },
    pointCount: { color: C.online, fontSize: 12, textAlign: 'center', marginTop: 4 },

    mapWrap: { flex: 1 },
    mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    mapEmptyIcon: { fontSize: 48, marginBottom: 12 },
    mapEmptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

    floatingInfoCard: {
        position: 'absolute', top: 12, right: 12, zIndex: 100,
        backgroundColor: C.bgSecondary + 'EE', borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 10,
        borderWidth: 1, borderColor: C.border,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    infoValue: { fontSize: 12, fontWeight: '600', color: C.textPrimary },
    infoSep: { width: 1, height: 14, backgroundColor: C.border },

    playbar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.bgSecondary,
        borderTopWidth: 1, borderColor: C.border,
        paddingHorizontal: 12, paddingVertical: 10, gap: 10,
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    },
    playBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center',
    },
    listBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },

    progressInfo: { flex: 1 },
    progressBarBg: {
        height: 4, backgroundColor: C.border, borderRadius: 2,
        overflow: 'hidden', marginBottom: 6,
    },
    progressBarFill: { height: 4, borderRadius: 2 },
    playStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    playSpeed: { fontSize: 13, fontWeight: '700' },
    playTime: { fontSize: 12, color: '#94a3b8' },
    playProgress: { fontSize: 11, color: '#64748b', marginLeft: 'auto' as never },

    speedWrap: { flexDirection: 'row', gap: 4 },
    speedBtn: {
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    speedBtnActive: { backgroundColor: C.accentDim, borderColor: C.accent },
    speedBtnText: { fontSize: 10, fontWeight: '700', color: C.textMuted },

    drawerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
        justifyContent: 'flex-end',
    },
    drawerContainer: {
        backgroundColor: C.bgSecondary,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '60%', minHeight: '40%', paddingHorizontal: 16, paddingVertical: 14,
    },
    drawerHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 12, borderBottomWidth: 1, borderColor: C.border,
    },
    drawerTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
    drawerCloseBtn: { padding: 4 },
    tableHeaderRow: {
        flexDirection: 'row', paddingVertical: 8,
        borderBottomWidth: 1, borderColor: C.border,
    },
    colHeader: { fontSize: 12, fontWeight: '600', color: C.textMuted },
    tableRow: {
        flexDirection: 'row', paddingVertical: 12,
        borderBottomWidth: 1, borderColor: C.border,
        alignItems: 'center',
    },
    activeTableRow: { backgroundColor: C.accentDim + '22' },
    tableCell: { fontSize: 12, color: C.textPrimary },
    activeCellText: { color: C.accent, fontWeight: '700' },

    // ── Date Picker Modal styles ──────────────────────────────────────────
    modalOverlay: {
        flex: 1, justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modalSheet: {
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30,
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2, shadowRadius: 12, elevation: 12,
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 12,
    },
    modalTitle: { fontSize: 16, fontWeight: '700' },
    pickerRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16,
    },
    pickerCol: { alignItems: 'center', flex: 1 },
    pickerColLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 },
    confirmBtn: {
        borderRadius: 12, paddingVertical: 14,
        alignItems: 'center', marginTop: 4,
    },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

