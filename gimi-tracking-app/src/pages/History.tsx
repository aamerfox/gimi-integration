import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import { gimiService } from '../services/gimi';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { formatGimiTime } from '../utils/time';
import { AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Calendar, Play, Pause, Zap, Clock, Navigation, AlertTriangle } from 'lucide-react';

const GOOGLE_STREET_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const GOOGLE_STREET_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';
const GOOGLE_SATELLITE_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
const GOOGLE_SATELLITE_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';

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
    const { t } = useTranslation();

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
        const getLocalISOString = (d: Date) => {
            return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        };
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        setStartTime(getLocalISOString(dayAgo));
        setEndTime(getLocalISOString(now));
    }, []);

    // Init map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const streetLayer = L.tileLayer(GOOGLE_STREET_URL, { attribution: GOOGLE_STREET_ATTR, maxZoom: 18 });
        const satelliteLayer = L.tileLayer(GOOGLE_SATELLITE_URL, { attribution: GOOGLE_SATELLITE_ATTR, maxZoom: 18 });

        const baseMaps = {
            "Google Streets": streetLayer,
            "Google Satellite": satelliteLayer,
        };

        const map = L.map(containerRef.current, {
            center: [24.7136, 46.6753],
            zoom: 5,
            zoomControl: false,
            layers: [streetLayer]
        });

        L.control.layers(baseMaps).addTo(map);
        mapRef.current = map;

        setTimeout(() => map.invalidateSize(), 100);
        return () => { map.remove(); mapRef.current = null; };
    }, []);

    // Load Track logic
    const loadTrack = useCallback(async () => {
        if (!accessToken || !selectedImei || !startTime || !endTime) return;
        setLoading(true);
        setError(null);
        setTrack([]);
        setPlaybackIndex(0);
        setPlaying(false);

        try {
            const startObj = new Date(startTime);
            const endObj = new Date(endTime);
            const diffMs = endObj.getTime() - startObj.getTime();
            const maxDays = 7;
            if (diffMs > maxDays * 24 * 60 * 60 * 1000) throw new Error(t('history.maxDaysExceeded'));
            if (diffMs <= 0) throw new Error('Invalid date range. Return time must be after start time.');

            const CHUNK_SIZE_MS = 48 * 60 * 60 * 1000 - 1000;
            const chunks: { s: string, e: string }[] = [];
            let current = new Date(startObj);
            
            while (current < endObj) {
                let next = new Date(current.getTime() + CHUNK_SIZE_MS);
                if (next > endObj) next = endObj;
                const pad = (n: number) => n.toString().padStart(2, '0');
                const formatForApi = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                chunks.push({ s: formatForApi(current), e: formatForApi(next) });
                current = new Date(next.getTime() + 1000); 
            }

            let allPoints: TrackPoint[] = [];

            for (const chunk of chunks) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const res = await gimiService.getTrackHistory(accessToken, selectedImei, chunk.s, chunk.e) as any;
                if (res?.result && Array.isArray(res.result)) allPoints = allPoints.concat(res.result);
            }

            if (allPoints.length > 0) {
                const points: TrackPoint[] = allPoints.map((p) => ({
                    lat: p.lat, lng: p.lng, speed: p.speed || 0, gpsTime: p.gpsTime || '', direction: p.direction || 0,
                }));
                points.sort((a, b) => a.gpsTime.localeCompare(b.gpsTime));
                setTrack(points);
                drawTrack(points);
            } else {
                setError('لا توجد بيانات مسار لهذه الفترة.');
            }
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'فشل تحميل المسار';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    }, [accessToken, selectedImei, startTime, endTime, t]);

    const drawTrack = (points: TrackPoint[]) => {
        const map = mapRef.current;
        if (!map || points.length === 0) return;

        if (polylineRef.current) polylineRef.current.remove();
        if (markerRef.current) markerRef.current.remove();

        const latLngs: L.LatLngExpression[] = points.map(p => [p.lat, p.lng]);

        polylineRef.current = L.polyline(latLngs, { color: '#4f46e5', weight: 4, opacity: 0.9 }).addTo(map);

        L.circleMarker([points[0].lat, points[0].lng], { radius: 6, fillColor: '#22c55e', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map);
        const last = points[points.length - 1];
        L.circleMarker([last.lat, last.lng], { radius: 6, fillColor: '#ef4444', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map);

        const playIcon = L.divIcon({
            className: '', iconSize: [24, 24], iconAnchor: [12, 12],
            html: `<div style="width:24px;height:24px;border-radius:50%;background:#4f46e5;border:3px solid #fff;box-shadow:0 0 12px rgba(79,70,229,0.5)"></div>`,
        });
        markerRef.current = L.marker([points[0].lat, points[0].lng], { icon: playIcon }).addTo(map);

        map.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
    };

    // Playback controls
    useEffect(() => {
        if (playing && track.length > 0) {
            playIntervalRef.current = window.setInterval(() => {
                setPlaybackIndex(prev => {
                    if (prev >= track.length - 1) { setPlaying(false); return prev; }
                    const next = prev + 1;
                    if (markerRef.current) markerRef.current.setLatLng([track[next].lat, track[next].lng]);
                    return next;
                });
            }, 500 / playbackSpeed);
        }
        return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
    }, [playing, playbackSpeed, track]);

    // Analytics Aggregation
    const maxSpeed = track.length > 0 ? Math.max(...track.map(t => t.speed)) : 0;
    const idleCount = track.filter(t => t.speed === 0).length;
    const movingCount = track.length - idleCount;

    return (
        <div className="relative h-[100vh] w-full flex flex-col bg-slate-900 overflow-hidden">
            {/* Background Map - 45% height */}
            <div ref={containerRef} className="absolute inset-0 z-0 h-[45vh] w-full" />

            {/* Bottom Sheet UI - 55% height */}
            <div className="absolute inset-x-0 bottom-0 top-[40vh] bg-slate-50 dark:bg-slate-900 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-10 flex flex-col pt-2 pb-20">
                {/* Drag Handle */}
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

                <div className="flex-1 overflow-y-auto px-5 space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">التقارير التحليلية</h2>
                        <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full font-bold">تتبع المسار</span>
                    </div>

                    {/* Controls Panel */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">الجهاز الذكي</label>
                                <select value={selectedImei} onChange={(e) => setSelectedImei(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500">
                                    <option value="">-- اختر مركبة --</option>
                                    {devices.map((d: Device) => <option key={d.imei} value={d.imei}>{d.deviceName}</option>)}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">من تاريخ</label>
                                    <div className="relative">
                                        <Calendar size={14} className="absolute inset-y-0 start-3 my-auto text-slate-400" />
                                        <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ps-9 pe-2 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">إلى تاريخ</label>
                                    <div className="relative">
                                        <Calendar size={14} className="absolute inset-y-0 start-3 my-auto text-slate-400" />
                                        <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ps-9 pe-2 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300" />
                                    </div>
                                </div>
                            </div>

                            <button onClick={loadTrack} disabled={loading || !selectedImei} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">
                                {loading ? 'جاري التحميل...' : 'تحليل وعرض المسار'}
                            </button>

                            {error && <div className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg text-center">{error}</div>}
                        </div>
                    </div>

                    {/* Analytics Section (visible if track loaded) */}
                    {track.length > 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                                    <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center mx-auto mb-2">
                                        <Zap size={16} />
                                    </div>
                                    <h4 className="text-[10px] text-slate-500 font-bold mb-0.5">أقصى سرعة</h4>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{maxSpeed} <span className="text-[9px] font-normal text-slate-400">km/h</span></p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                                    <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center mx-auto mb-2">
                                        <AlertTriangle size={16} />
                                    </div>
                                    <h4 className="text-[10px] text-slate-500 font-bold mb-0.5">توقف تام</h4>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{idleCount} <span className="text-[9px] font-normal text-slate-400">نقطة</span></p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                                        <Navigation size={16} />
                                    </div>
                                    <h4 className="text-[10px] text-slate-500 font-bold mb-0.5">زمن الرحلة</h4>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{movingCount} <span className="text-[9px] font-normal text-slate-400">نقطة حركة</span></p>
                                </div>
                            </div>

                            {/* Speed Profile Chart */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                                <h3 className="text-xs font-bold text-slate-500 mb-4 flex items-center gap-2">
                                    <Clock size={14} /> رسم بياني لسرعة المركبة
                                </h3>
                                <div className="h-32 w-full" dir="ltr">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={track} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <RechartsTooltip 
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload as TrackPoint;
                                                        return (
                                                            <div className="bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg border border-slate-700" dir="ltr">
                                                                <p className="font-bold text-indigo-300">{data.speed} km/h</p>
                                                                <p className="opacity-70">{formatGimiTime(data.gpsTime)}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Area type="monotone" dataKey="speed" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorSpeed)" isAnimationActive={true} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Sticky Playback Bar */}
                            <div className="sticky bottom-0 bg-slate-800 text-white rounded-2xl p-3 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)] mt-6">
                                <button onClick={() => { if (playbackIndex >= track.length - 1) setPlaybackIndex(0); setPlaying(!playing); }} className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center transition-colors">
                                    {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1 rtl:ml-0 rtl:mr-1" />}
                                </button>
                                
                                <div className="flex-1 mx-4">
                                    <input type="range" min={0} max={track.length - 1} value={playbackIndex} onChange={(e) => { const idx = parseInt(e.target.value); setPlaybackIndex(idx); if (markerRef.current) markerRef.current.setLatLng([track[idx].lat, track[idx].lng]); }} className="w-full accent-indigo-500 h-1.5 bg-slate-600 rounded-lg appearance-none" />
                                    <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                                        <span>البداية</span>
                                        <span>النهاية</span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-indigo-300 mb-1">السرعة x{playbackSpeed}</span>
                                    <input type="range" min={1} max={10} value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))} className="w-12 h-1 accent-white bg-slate-600" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
