/**
 * Reports Page
 * 
 * Note: UTC time conversion is handled via `formatToUtcApiTime` in `src/utils/time.ts`,
 * which performs getUTCFullYear, getUTCMonth, getUTCDate, and getUTCHours conversions.
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useDeviceStore } from '../store/devices';
import { gimiService } from '../services/gimi';
import { formatGimiTime, getLocalIsoString, formatToUtcApiTime, formatToLocalApiTime } from '../utils/time';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
    Calendar, TrendingUp, Loader2, Download, Search, AlertTriangle, ShieldAlert
} from 'lucide-react';

// --- Types ---
interface TripData {
    id: string;
    deviceName: string;
    startTime: string;
    endTime: string;
    startLocation: string;
    endLocation: string;
    mileage: number; // km
    duration: string; // e.g. "1h 15m"
    avgSpeed: number; // km/h
    maxSpeed: number; // km/h
    startLat?: number;
    startLng?: number;
    endLat?: number;
    endLng?: number;
    imei?: string;
}

interface ParkingData {
    id: string;
    deviceName: string;
    startTime: string;
    endTime: string;
    duration: string;
    location: string;
    lat?: number;
    lng?: number;
    idleTimeSec: number;
    accType?: 'on' | 'off' | 'derived';
    imei?: string;
}

interface AlarmData {
    id: string;
    deviceName: string;
    time: string;
    type: string;
    speed: number;
    location: string;
    lat?: number;
    lng?: number;
    imei?: string;
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

export default function Reports() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const isRtl = i18n.dir() === 'rtl';
    const { accessToken, userId } = useAuthStore();
    const { devices } = useDeviceStore();

    // --- State ---
    const [selectedImei, setSelectedImei] = useState<string>('all');
    const [reportType, setReportType] = useState<'trips' | 'parking' | 'alarms'>('trips');
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1); // default to past 24 hours
        d.setHours(0, 0, 0, 0);
        return getLocalIsoString(d);
    });
    const [endDate, setEndDate] = useState<string>(() => {
        const d = new Date();
        return getLocalIsoString(d);
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [simulationMode, setSimulationMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- Data Results States ---
    const [tripsResult, setTripsResult] = useState<TripData[]>([]);
    const [parkingResult, setParkingResult] = useState<ParkingData[]>([]);
    const [alarmsResult, setAlarmsResult] = useState<AlarmData[]>([]);

    // --- Pagination ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- Specific Report Filters States ---
    const [minTripDistance, setMinTripDistance] = useState<number>(0);
    const [accType] = useState<'on' | 'off' | 'all'>('off');
    const [minStopDuration, setMinStopDuration] = useState<number>(0);
    const [selectedAlarmType, setSelectedAlarmType] = useState<string>('all');



    // --- Reverse geocode helper (lat,lng → address string) ---
    const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
        if (!lat || !lng || (lat === 0 && lng === 0)) return '—';
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`, {
                headers: { 'Accept-Language': i18n.language === 'ar' ? 'ar' : 'en' }
            });
            const data = await res.json();
            if (data?.display_name) {
                // Shorten: take first 2-3 parts of the address
                const parts = data.display_name.split(',').map((s: string) => s.trim());
                return parts.slice(0, 3).join(', ');
            }
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch {
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    };

    // --- Generate Simulation Data ---
    // --- Generate Simulation Data ---
    const getMockTrips = (deviceName: string, imei: string, startStr: string, endStr: string): TripData[] => {
        const mockTrips: TripData[] = [];
        const start = new Date(startStr);
        const end = new Date(endStr);
        const diffMs = end.getTime() - start.getTime();
        const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        const locations = isRtl
            ? ["مكتب الرياض الرئيسي", "مطار الملك خالد الدولي", "ميناء جدة الإسلامي", "مستودع الخرج", "المنطقة الصناعية الثانية", "الدمام الساحلي"]
            : ["Riyadh Main Office", "King Khalid Int Airport", "Jeddah Islamic Port", "Al-Kharj Warehouse", "Dammam Coastal Area", "Industrial City 2"];

        for (let i = 0; i < days * 2; i++) {
            const tripStart = new Date(start.getTime() + (i * diffMs) / (days * 2.5));
            const tripEnd = new Date(tripStart.getTime() + 30 * 60 * 1000 + Math.random() * 90 * 60 * 1000); // 30m - 2h
            if (tripEnd > end) break;

            const distance = parseFloat((5 + Math.random() * 85).toFixed(1));
            const durationMs = tripEnd.getTime() - tripStart.getTime();
            const hours = Math.floor(durationMs / (1000 * 60 * 60));
            const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

            mockTrips.push({
                id: `trip-${i}`,
                deviceName,
                imei,
                startTime: tripStart.toISOString().replace('T', ' ').slice(0, 19),
                endTime: tripEnd.toISOString().replace('T', ' ').slice(0, 19),
                startLocation: locations[i % locations.length],
                endLocation: locations[(i + 1) % locations.length],
                mileage: distance,
                duration: `${hours}h ${mins}m`,
                avgSpeed: Math.round(30 + Math.random() * 45),
                maxSpeed: Math.round(80 + Math.random() * 40),
                startLat: 24.702785 + (Math.random() - 0.5) * 0.1,
                startLng: 46.722700 + (Math.random() - 0.5) * 0.1,
                endLat: 24.702785 + (Math.random() - 0.5) * 0.1,
                endLng: 46.722700 + (Math.random() - 0.5) * 0.1,
            });
        }
        return mockTrips;
    };

    const getMockParking = (deviceName: string, imei: string, startStr: string, endStr: string): ParkingData[] => {
        const mockParking: ParkingData[] = [];
        const start = new Date(startStr);
        const end = new Date(endStr);
        const diffMs = end.getTime() - start.getTime();
        const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        const locations = isRtl
            ? ["مواقف أسواق العثيم", "شارع التخصصي", "طريق الملك فهد", "مستودع السلي", "استراحة الطريق السريع"]
            : ["Othaim Market Parking", "Takhassusi Street", "King Fahd Road", "Al-Sulay Warehouse", "Highway Rest Stop"];

        for (let i = 0; i < days * 4; i++) {
            const stopStart = new Date(start.getTime() + (i * diffMs) / (days * 4.2) + 1 * 60 * 60 * 1000);
            const stopEnd = new Date(stopStart.getTime() + 1 * 60 * 1000 + Math.random() * 180 * 60 * 1000); // 1m - 3h
            if (stopEnd > end) break;

            const durationMs = stopEnd.getTime() - stopStart.getTime();
            const hours = Math.floor(durationMs / (1000 * 60 * 60));
            const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

            const isAccOn = i % 3 === 0;

            mockParking.push({
                id: `parking-${i}`,
                deviceName,
                imei,
                startTime: stopStart.toISOString().replace('T', ' ').slice(0, 19),
                endTime: stopEnd.toISOString().replace('T', ' ').slice(0, 19),
                duration: `${hours}h ${mins}m`,
                location: locations[i % locations.length] + (isAccOn ? (isRtl ? " (ACC ON - تشغيل)" : " (ACC ON)") : ""),
                idleTimeSec: Math.floor(durationMs / 1000),
                accType: isAccOn ? 'on' : 'off',
                lat: 24.702785 + (Math.random() - 0.5) * 0.1,
                lng: 46.722700 + (Math.random() - 0.5) * 0.1,
            });
        }
        return mockParking;
    };

    const getMockAlarms = (deviceName: string, imei: string, startStr: string, endStr: string): AlarmData[] => {
        const mockAlarms: AlarmData[] = [];
        const start = new Date(startStr);
        const end = new Date(endStr);
        const diffMs = end.getTime() - start.getTime();
        const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        const alarmTypes = isRtl
            ? ["سرعة زائدة", "دخول السياج الجغرافي", "خروج من السياج الجغرافي", "اهتزاز مفاجئ", "انخفاض طاقة البطارية"]
            : ["Overspeed", "Geofence Enter", "Geofence Exit", "Vibration Alarm", "Low Battery"];

        const locations = isRtl
            ? ["الرياض، طريق مكة", "مخرج 10، الدائري الشرقي", "طريق الدمام السريع", "جدة، حي الروضة"]
            : ["Riyadh, Makkah Rd", "Exit 10, Eastern Ring Rd", "Dammam Highway", "Jeddah, Al-Rawdah"];

        for (let i = 0; i < days * 3; i++) {
            const alarmTime = new Date(start.getTime() + (i * diffMs) / (days * 3.1) + 1 * 60 * 60 * 1000);
            if (alarmTime > end) break;

            mockAlarms.push({
                id: `alarm-${i}`,
                deviceName,
                imei,
                time: alarmTime.toISOString().replace('T', ' ').slice(0, 19),
                type: alarmTypes[i % alarmTypes.length],
                speed: i % 2 === 0 ? Math.round(122 + Math.random() * 25) : 0,
                location: locations[i % locations.length],
                lat: 24.702785 + (Math.random() - 0.5) * 0.1,
                lng: 46.722700 + (Math.random() - 0.5) * 0.1,
            });
        }
        return mockAlarms;
    };

    // --- Main Generate Handler ---
    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setCurrentPage(1);

        try {
            // Find active device name
            let targetDeviceName = t('reports.allDevices');
            let singleImei = '';
            if (selectedImei !== 'all') {
                const targetDev = devices.find(d => d.imei === selectedImei);
                targetDeviceName = targetDev ? targetDev.deviceName : selectedImei;
                singleImei = selectedImei;
            }

            if (simulationMode) {
                const mockImei = singleImei || (devices[0]?.imei || '12345');
                // Generate mock records
                if (reportType === 'trips') {
                    const mock = getMockTrips(targetDeviceName, mockImei, startDate, endDate);
                    setTripsResult(mock);
                } else if (reportType === 'parking') {
                    const mock = getMockParking(targetDeviceName, mockImei, startDate, endDate);
                    setParkingResult(mock);
                } else {
                    const mock = getMockAlarms(targetDeviceName, mockImei, startDate, endDate);
                    setAlarmsResult(mock);
                }
            } else {
                // Call real Tracksolid APIs
                if (!accessToken) {
                    throw new Error("No access token available. Please log in again.");
                }

                const startApiTime = formatToUtcApiTime(startDate);
                const endApiTime = formatToUtcApiTime(endDate);

                if (reportType === 'trips') {
                    // Trips Report (using jimi.open.platform.report.trips — matches TrackSolid Pro)
                    const imeiParam = singleImei || devices.map(d => d.imei).join(',');
                    if (!imeiParam) throw new Error("No device IMEIs available to query.");

                    // Fetch trips report AND mileage API in parallel (mileage API = same source History page uses)
                    const imeiList = imeiParam.split(',').filter(Boolean);

                    // Fetch trips report AND mileage API in parallel
                    // IMPORTANT: Trips report uses UTC (jimi.open.platform.report.trips uses UTC).
                    // Mileage API (jimi.device.track.mileage) uses LOCAL timezone of the account.
                    // This is why the mileage API was returning 0 — we were sending UTC times.
                    const mileageStartTime = formatToLocalApiTime(startDate); // LOCAL time for mileage API
                    const mileageEndTime = formatToLocalApiTime(endDate);     // LOCAL time for mileage API

                    console.log('[Reports] Fetching trips + mileage for IMEIs:', imeiList);
                    console.log('[Reports] Trips API time (UTC):', startApiTime, '→', endApiTime);
                    console.log('[Reports] Mileage API time (LOCAL):', mileageStartTime, '→', mileageEndTime);

                    const [res, ...mileageResults] = await Promise.all([
                        gimiService.getTripsReport(
                            accessToken,
                            userId || '',
                            imeiParam,
                            startApiTime,
                            endApiTime
                        ),
                        // MILEAGE API: use LOCAL time (account timezone), not UTC
                        ...imeiList.map(imei =>
                            gimiService.getTrackMileage(accessToken, imei, mileageStartTime, mileageEndTime)
                                .catch(() => null)
                        )
                    ]) as any[];

                    console.log('[Reports] Raw trips response:', JSON.stringify(res));
                    console.log('[Reports] Mileage results:', mileageResults.map((r, i) => ({ imei: imeiList[i], result: r })));

                    // Build a lookup of IMEI → mileage (km) from the mileage API
                    const mileageLookup: Record<string, number> = {};
                    imeiList.forEach((imei, idx) => {
                        const mRes = mileageResults[idx];
                        if (!mRes) return;
                        let mileageVal = 0;
                        // The mileage API can return in multiple formats — check all
                        if (Array.isArray(mRes?.result) && mRes.result.length > 0) {
                            mileageVal = mRes.result[0].mileage ?? mRes.result[0].total_mileage ?? mRes.result[0].totalMileage ?? 0;
                        } else if (mRes?.result?.mileage !== undefined) {
                            mileageVal = mRes.result.mileage;
                        } else if (mRes?.result?.total_mileage !== undefined) {
                            mileageVal = mRes.result.total_mileage;
                        } else if (mRes?.data && Array.isArray(mRes.data) && mRes.data.length > 0) {
                            mileageVal = mRes.data[0].mileage ?? mRes.data[0].total_mileage ?? 0;
                        } else if (mRes?.data && typeof mRes.data === 'object' && !Array.isArray(mRes.data)) {
                            // data is a plain object — log it fully to see its structure, then try all known fields
                            console.log(`[Reports] Mileage API data object for ${imei}:`, JSON.stringify(mRes.data));
                            mileageVal = mRes.data.mileage ?? mRes.data.total_mileage ?? mRes.data.totalMileage ??
                                         mRes.data.total ?? mRes.data.distance ?? mRes.data.dis ?? 0;
                        }
                        // Mileage API always returns value in METERS → always divide by 1000 to get km
                        // Do NOT use a heuristic here — the API contract is always meters
                        const rawNum = Number(mileageVal || 0);
                        const mileageKm = rawNum / 1000;
                        mileageLookup[imei] = mileageKm;
                        console.log(`[Reports] Mileage for ${imei}: raw=${mileageVal} meters → ${mileageKm.toFixed(3)} km`);
                    });

                    // --- Parse the trips API response ---
                    // The API returns result (array of trips) OR data.datDatas (trip records) OR data.dayList (device summaries)
                    // data.dayList items are device HEADER rows (openFlag, imei, deviceName) — NOT individual trips
                    // data.datDatas would be the actual per-trip records (often null on first load)
                    // data.totalData.totalDis is the TOTAL distance for the period (authoritative)
                    const resData = (res as any)?.data;
                    const responseTotalDisKm = parseFloat(resData?.totalData?.totalDis || resData?.totalData?.total_dis || 0);
                    const responseTotalTime = resData?.totalData?.totalTime || '';
                    const responseTotalTrips = parseInt(resData?.totalData?.totalTrips || 0);
                    console.log(`[Reports] Response summary: totalDis=${responseTotalDisKm} km, totalTrips=${responseTotalTrips}`);

                    const tripsList = (res as any)?.result || resData || [];
                    // Prefer datDatas (actual trip records) over dayList (device headers)
                    let rawTrips: any[] = [];
                    if (Array.isArray(tripsList)) {
                        rawTrips = tripsList;
                    } else if (Array.isArray(tripsList?.datDatas) && tripsList.datDatas.length > 0) {
                        rawTrips = tripsList.datDatas; // actual trip records
                    } else if (Array.isArray(tripsList?.tripsData) && tripsList.tripsData.length > 0) {
                        rawTrips = tripsList.tripsData;
                    } else if (Array.isArray(tripsList?.dayList) && tripsList.dayList.length > 0) {
                        rawTrips = tripsList.dayList; // device headers — will be handled specially below
                    }
                    console.log(`[Reports] rawTrips count: ${rawTrips.length}, first item keys: ${rawTrips.length > 0 ? Object.keys(rawTrips[0]).join(', ') : 'none'}`);

                    if (rawTrips.length > 0) {
                        // Reverse-geocode start/end coordinates for each trip
                        const records: TripData[] = await Promise.all(
                            rawTrips.map(async (item: any, index: number) => {
                                const itemImei = item.imei || item.deviceImei || item.device_imei || item.device_no || item.deviceNo;
                                // FIX: Always resolve a targetImei. The trips API often omits 'imei' in each row.
                                // Priority: item's own imei → the selected single imei → the first/only imei in the list
                                const targetImei = itemImei
                                    || (singleImei && singleImei !== 'all' ? singleImei : '')
                                    || (imeiList.length === 1 ? imeiList[0] : '');
                                const dev = devices.find(d => d.imei === (itemImei || targetImei));
                                const devName = dev ? dev.deviceName : (itemImei || targetDeviceName);

                                console.log(`[Reports] Trip item keys:`, Object.keys(item).join(', '));
                                console.log(`[Reports] itemImei=${itemImei}, targetImei=${targetImei}, mileageLookup[targetImei]=${mileageLookup[targetImei]}`);

                                const startLat = parseFloat(item.startLat || item.start_lat || 0);
                                const startLng = parseFloat(item.startLng || item.start_lng || 0);
                                const endLat = parseFloat(item.endLat || item.end_lat || 0);
                                const endLng = parseFloat(item.endLng || item.end_lng || 0);

                                // --- Distance resolution (multi-strategy) ---
                                let distKm = 0;

                                // Timestamps — check item first, fall back to query range
                                // dayList items (device headers) have NO startTime/endTime — use query range
                                const rawStart = item.startTime || item.start_time || item.enterTime || item.enter_time || startApiTime;
                                const rawEnd = item.endTime || item.end_time || item.exitTime || item.exit_time || endApiTime;
                                const displayStart = item.startTime || item.start_time ? formatGimiTime(rawStart) : startDate.replace('T', ' ');
                                const displayEnd = item.endTime || item.end_time ? formatGimiTime(rawEnd) : endDate.replace('T', ' ');
                                const isDeviceHeaderRow = !item.startTime && !item.start_time && !item.endTime && !item.end_time;
                                console.log(`[Reports] isDeviceHeaderRow=${isDeviceHeaderRow}, rawStart=${rawStart}, rawEnd=${rawEnd}`);

                                // Strategy 1a: Use the trips API distance field in the item itself
                                const distRaw = parseFloat(
                                    item.distance ||
                                    item.totalMileage || item.total_mileage ||
                                    item.mileage ||
                                    item.run_mileage || item.runMileage ||
                                    item.totalDis || item.total_dis ||
                                    item.dis ||
                                    item.dist ||
                                    0
                                );
                                if (distRaw > 0) {
                                    // Heuristic: if value > 500, it's likely meters; otherwise km
                                    distKm = distRaw > 500 ? distRaw / 1000 : distRaw;
                                    console.log(`[Reports] Strategy 1a success: distRaw=${distRaw} → distKm=${distKm}`);
                                }

                                // ===================================================================
                                // STRATEGY 0 (ULTIMATE PRIORITY): Use todayMileage from device store
                                // This is the EXACT same number shown in TrackSolid's live widget.
                                // The live widget reads it from jimi.user.device.location.list.
                                // Our polling hook updates it every 15 seconds automatically.
                                // Only available for today's date — historical dates must use other strategies.
                                // ===================================================================
                                const deviceObj = devices.find(d => d.imei === targetImei);
                                const liveTodayKm = deviceObj
                                    ? Number(deviceObj.todayMileage ?? deviceObj.today_mileage ?? deviceObj.todayDis ?? deviceObj.today_dis ?? deviceObj.runMileage ?? 0)
                                    : 0;

                                // Detect if this report covers "today" (same calendar day as now in local time)
                                const todayStr = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD' in local tz
                                const endDateStr = endDate.split('T')[0]; // from the picker, already local
                                const startDateStr = startDate.split('T')[0];
                                const isToday = endDateStr === todayStr && startDateStr === todayStr;

                                if (liveTodayKm > 0 && isToday) {
                                    distKm = liveTodayKm / Math.max(1, rawTrips.length);
                                    console.log(`[Reports] Strategy 0 (todayMileage from live widget): ${liveTodayKm} / ${rawTrips.length} → ${distKm.toFixed(3)} km ✅`);
                                } else {
                                    console.log(`[Reports] Strategy 0 skip: liveTodayKm=${liveTodayKm}, isToday=${isToday} (startDate=${startDateStr}, endDate=${endDateStr}, todayStr=${todayStr})`);
                                }

                                // Strategy 2 (HIGHEST PRIORITY for device header rows):
                                // Use the dedicated mileage API result — this is the SAME source as TrackSolid live widget.
                                // Run this BEFORE totalDis (Strategy 1b) because the mileage API is more accurate.
                                if (distKm <= 0 && targetImei && mileageLookup[targetImei] > 0) {
                                    const tripsForImei = rawTrips.filter((t: any) => {
                                        const tImei = t.imei || t.deviceImei || t.device_imei || t.device_no || t.deviceNo || targetImei;
                                        return tImei === targetImei;
                                    });
                                    distKm = mileageLookup[targetImei] / Math.max(1, tripsForImei.length);
                                    console.log(`[Reports] Strategy 2 (mileage API WIN): ${mileageLookup[targetImei]} / ${tripsForImei.length} → ${distKm.toFixed(3)} km`);
                                }

                                // Strategy 1b: For device header rows, use response totalData.totalDis
                                // Only used when mileage API returned 0 (offline device, API error, etc.)
                                if (distKm <= 0 && isDeviceHeaderRow && responseTotalDisKm > 0) {
                                    distKm = responseTotalDisKm / Math.max(1, rawTrips.length);
                                    console.log(`[Reports] Strategy 1b (totalDis fallback): ${responseTotalDisKm} / ${rawTrips.length} → ${distKm} km`);
                                }

                                // Strategy 3: Use the mileage API result for this IMEI
                                // (only reached if mileage API also returned 0 — offline/no data)
                                // This was originally Strategy 2 but moved down since mileage API now runs earlier
                                if (distKm <= 0 && targetImei && mileageLookup[targetImei] > 0) {
                                    // This path is only reached for NON-header rows where Strategy 2 didn't apply
                                    const tripsForImei = rawTrips.filter((t: any) => {
                                        const tImei = t.imei || t.deviceImei || t.device_imei || t.device_no || t.deviceNo || targetImei;
                                        return tImei === targetImei;
                                    });
                                    distKm = mileageLookup[targetImei] / Math.max(1, tripsForImei.length);
                                    console.log(`[Reports] Strategy 3 (mileage API for non-header): ${mileageLookup[targetImei]} / ${tripsForImei.length} → ${distKm.toFixed(3)} km`);
                                }

                                // Strategy 4: Compute distance from GPS track points using Haversine
                                // Uses LOCAL time boundaries (same as Dashboard's 'Today's Mileage' calculation).
                                // BEACON JUMP FILTER: If implied speed between two points exceeds 150 km/h,
                                // the segment is a Bluetooth anchor jump (not real movement) and is skipped.
                                // This prevents BEACON devices from showing unrealistic distances (e.g. 420 km).
                                if (distKm <= 0 && targetImei) {
                                    try {
                                        const trackBegin = mileageStartTime;
                                        const trackEnd = mileageEndTime;
                                        console.log(`[Reports] Strategy 4 (Haversine LOCAL): fetching track for ${targetImei} from ${trackBegin} to ${trackEnd}`);
                                        const trackRes = await gimiService.getTrackHistory(
                                            accessToken,
                                            targetImei,
                                            trackBegin,
                                            trackEnd
                                        ) as any;

                                        const pts = trackRes?.result || trackRes?.data || [];
                                        const points = Array.isArray(pts) ? pts : (pts?.list || []);
                                        console.log(`[Reports] Strategy 4: got ${points.length} track points`);
                                        if (points.length > 1) {
                                            let calcMeters = 0;
                                            let skipped = 0;
                                            let prevPoint: any = null;
                                            let prevMs = 0;

                                            // Helper to parse Gimi UTC time string → ms
                                            const parsePtMs = (pt: any): number => {
                                                const s: string = pt.gpsTime || pt.gps_time || pt.time || pt.positionTime || '';
                                                if (!s) return 0;
                                                const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
                                                return isNaN(d.getTime()) ? 0 : d.getTime();
                                            };

                                            const MAX_SPEED_KMH = 150; // above this = BEACON anchor jump, not real movement

                                            for (const pt of points) {
                                                if (!pt) continue;
                                                const lat = Number(pt.lat ?? pt.latitude ?? 0);
                                                const lng = Number(pt.lng ?? pt.lon ?? pt.longitude ?? 0);
                                                if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

                                                const currMs = parsePtMs(pt);

                                                if (prevPoint) {
                                                    const distM = haversineDistance(prevPoint.lat, prevPoint.lng, lat, lng);
                                                    const timeSec = currMs > 0 && prevMs > 0
                                                        ? (currMs - prevMs) / 1000
                                                        : 0;
                                                    const speedKmh = timeSec > 0
                                                        ? (distM / timeSec) * 3.6
                                                        : 0;

                                                    // Include segment only if within reasonable speed
                                                    if (speedKmh <= MAX_SPEED_KMH || timeSec === 0) {
                                                        calcMeters += distM;
                                                    } else {
                                                        skipped++;
                                                        console.log(`[Reports] S4 skipped BEACON jump: ${distM.toFixed(0)}m in ${timeSec.toFixed(0)}s = ${speedKmh.toFixed(0)} km/h`);
                                                    }
                                                }
                                                prevPoint = { lat, lng };
                                                prevMs = currMs;
                                            }
                                            if (calcMeters > 0) {
                                                distKm = calcMeters / 1000;
                                                console.log(`[Reports] Strategy 4 success: ${calcMeters.toFixed(0)}m → ${distKm.toFixed(2)} km (${skipped} beacon jumps skipped)`);
                                            }
                                        }
                                    } catch (err) {
                                        console.error('[Reports] Strategy 4 (Haversine) failed:', err);
                                    }
                                }


                                if (distKm <= 0) {
                                    console.warn(`[Reports] All strategies returned 0 for item ${index}. Keys:`, Object.keys(item).join(', '));
                                }

                                // Duration — from seconds field or from totalTime if device header row
                                const durSec = parseInt(item.runTimeSecond || item.elapsed || item.run_time_second || item.totalRunTime || item.total_run_time || 0);
                                let hours = Math.floor(durSec / 3600);
                                let mins = Math.floor((durSec % 3600) / 60);
                                // For device header rows with no duration, use the response totalTime ("HH:MM:SS")
                                if (durSec === 0 && isDeviceHeaderRow && responseTotalTime) {
                                    const tParts = responseTotalTime.split(':').map(Number);
                                    hours = tParts[0] || 0;
                                    mins = tParts[1] || 0;
                                }

                                // Reverse geocode locations (with rate limiting)
                                const delay = index * 200; // 200ms between requests to avoid rate limit
                                await new Promise(r => setTimeout(r, delay));
                                const [startLoc, endLoc] = await Promise.all([
                                    reverseGeocode(startLat, startLng),
                                    reverseGeocode(endLat, endLng),
                                ]);

                                 return {
                                     id: `trip-api-${index}`,
                                     deviceName: devName,
                                     startTime: displayStart,
                                     endTime: displayEnd,
                                     startLocation: startLoc,
                                     endLocation: endLoc,
                                     mileage: distKm,
                                     duration: `${hours}h ${mins}m`,
                                     avgSpeed: Math.round(parseFloat(item.averageSpeed || item.avgSpeed || item.average_speed || 0)),
                                     maxSpeed: Math.round(parseFloat(item.maxSpeed || item.max_speed || 0)),
                                     startLat,
                                     startLng,
                                     endLat,
                                     endLng,
                                     imei: itemImei || targetImei,
                                 };
                            })
                        );
                        setTripsResult(records);
                    } else {
                        // No trips from API — try using mileage API + track history as a single synthetic trip
                        if (imeiList.length === 1 && mileageLookup[imeiList[0]] > 0) {
                            const imei = imeiList[0];
                            const dev = devices.find(d => d.imei === imei);
                            const devName = dev ? dev.deviceName : imei;
                             setTripsResult([{
                                 id: 'trip-mileage-fallback',
                                 deviceName: devName,
                                 startTime: startDate.replace('T', ' '),
                                 endTime: endDate.replace('T', ' '),
                                 startLocation: '—',
                                 endLocation: '—',
                                 mileage: mileageLookup[imei],
                                 duration: '—',
                                 avgSpeed: 0,
                                 maxSpeed: 0,
                                 imei: imei,
                             }]);
                        } else {
                            setTripsResult([]);
                        }
                    }
                } else if (reportType === 'parking') {
                    // Parking Report
                    if (!singleImei) {
                        throw new Error(t('reports.parkingDeviceRequired'));
                    }

                    // Helper: parse Gimi UTC time string → milliseconds (same logic as formatGimiTime)
                    const parseGimiMs = (t: any): number => {
                        if (!t) return 0;
                        const s = String(t).trim();
                        const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
                        return isNaN(d.getTime()) ? 0 : d.getTime();
                    };

                    const parkUtcStart = formatToUtcApiTime(startDate);
                    const parkUtcEnd = formatToUtcApiTime(endDate);
                    const parkLocalStart = formatToLocalApiTime(startDate);
                    const parkLocalEnd = formatToLocalApiTime(endDate);
                    console.log('[Reports] Parking UTC:', parkUtcStart, '→', parkUtcEnd);
                    console.log('[Reports] Parking LOCAL:', parkLocalStart, '→', parkLocalEnd);

                    // Try all 4 combinations: UTC+LOCAL × off+on
                    // TrackSolid uses same API family as trips (UTC), but BEACON devices may need LOCAL
                    // BEACON devices also have no ACC sensor, so both on/off must be tried
                    const [r1, r2, r3, r4] = await Promise.all([
                        gimiService.getParkingReport(accessToken, userId || '', singleImei, parkUtcStart, parkUtcEnd, 'off').catch(() => null),
                        gimiService.getParkingReport(accessToken, userId || '', singleImei, parkUtcStart, parkUtcEnd, 'on').catch(() => null),
                        gimiService.getParkingReport(accessToken, userId || '', singleImei, parkLocalStart, parkLocalEnd, 'off').catch(() => null),
                        gimiService.getParkingReport(accessToken, userId || '', singleImei, parkLocalStart, parkLocalEnd, 'on').catch(() => null),
                    ]) as any[];
                    console.log('[Reports] Parking API UTC+off:', JSON.stringify(r1));
                    console.log('[Reports] Parking API UTC+on:', JSON.stringify(r2));
                    console.log('[Reports] Parking API LOCAL+off:', JSON.stringify(r3));
                    console.log('[Reports] Parking API LOCAL+on:', JSON.stringify(r4));

                    const extractParking = (res: any): any[] => {
                        if (!res) return [];
                        if (Array.isArray(res.result)) return res.result;
                        if (res.result && Array.isArray((res.result as any).rows)) return (res.result as any).rows;
                        if (res.result && Array.isArray((res.result as any).list)) return (res.result as any).list;
                        if (res.result && Array.isArray((res.result as any).datDatas)) return (res.result as any).datDatas;
                        if (Array.isArray(res.data)) return res.data;
                        if (res.data && Array.isArray(res.data.rows)) return res.data.rows;
                        if (res.data && Array.isArray(res.data.list)) return res.data.list;
                        if (res.data && Array.isArray(res.data.datDatas)) return res.data.datDatas;
                        if (res.data && Array.isArray(res.data.dayList)) return res.data.dayList;
                        return [];
                    };

                    // Merge all results, deduplicating by startTime
                    const seenKeys = new Set<string>();
                    let rawParking: any[] = [...extractParking(r1), ...extractParking(r2), ...extractParking(r3), ...extractParking(r4)].filter(item => {
                        const key = item.startTime || item.start_time || item.enterTime || JSON.stringify(item);
                        if (seenKeys.has(key)) return false;
                        seenKeys.add(key);
                        return true;
                    });

                    console.log('[Reports] Parking API combined results:', rawParking.length, 'records');

                    // FALLBACK: Derive stops from GPS track history when API returns nothing
                    // This handles BEACON devices that don't generate parking events server-side.
                    // A "stop" = device stays within 100m for >= 5 consecutive minutes.
                    if (rawParking.length === 0) {
                        console.log('[Reports] Parking API returned 0 — deriving stops from GPS track history');
                        try {
                            const trackRes = await gimiService.getTrackHistory(accessToken, singleImei, parkLocalStart, parkLocalEnd) as any;
                            const pts = trackRes?.result || trackRes?.data || [];
                            const points: any[] = Array.isArray(pts) ? pts : (pts?.list || []);
                            console.log('[Reports] Track points for stop derivation:', points.length,
                                points.length > 0 ? 'first keys: ' + Object.keys(points[0]).join(', ') : '');

                            if (points.length > 1) {
                                const MIN_STOP_METERS = 150;  // within 150m = same location
                                const MIN_STOP_SECONDS = 5 * 60; // >= 5 minutes = a stop
                                const derivedStops: any[] = [];

                                // Find the time field name from the first point
                                const getTime = (pt: any) =>
                                    pt.gpsTime || pt.gps_time || pt.time || pt.positionTime || pt.position_time || '';

                                let stopStart = points[0];
                                let stopStartMs = parseGimiMs(getTime(points[0]));
                                let stopAnchor = { lat: Number(points[0].lat || 0), lng: Number(points[0].lng || 0) };

                                for (let i = 1; i < points.length; i++) {
                                    const pt = points[i];
                                    const lat = Number(pt.lat ?? 0);
                                    const lng = Number(pt.lng ?? 0);
                                    if (!lat || !lng) continue;

                                    const distFromAnchor = haversineDistance(stopAnchor.lat, stopAnchor.lng, lat, lng);
                                    if (distFromAnchor > MIN_STOP_METERS) {
                                        // Device moved — record previous stop if long enough
                                        const prevPt = points[i - 1];
                                        const stopEndMs = parseGimiMs(getTime(prevPt));
                                        const durationSec = (stopEndMs - stopStartMs) / 1000;
                                        console.log(`[Reports] Stop candidate: ${Math.round(durationSec)}s from ${getTime(stopStart)} to ${getTime(prevPt)}`);

                                        if (durationSec >= MIN_STOP_SECONDS && stopStartMs > 0 && stopEndMs > 0) {
                                            derivedStops.push({
                                                startTime: formatGimiTime(getTime(stopStart)),
                                                endTime: formatGimiTime(getTime(prevPt)),
                                                park_time_second: Math.round(durationSec),
                                                address: '—',
                                                lat: stopAnchor.lat,
                                                lng: stopAnchor.lng,
                                                _derived: true,
                                            });
                                        }
                                        stopStart = pt;
                                        stopStartMs = parseGimiMs(getTime(pt));
                                        stopAnchor = { lat, lng };
                                    }
                                }
                                // Check final stop (device might still be at last location)
                                const lastPt = points[points.length - 1];
                                const lastMs = parseGimiMs(getTime(lastPt));
                                const finalDurSec = (lastMs - stopStartMs) / 1000;
                                if (finalDurSec >= MIN_STOP_SECONDS && stopStartMs > 0 && lastMs > 0) {
                                    derivedStops.push({
                                        startTime: formatGimiTime(getTime(stopStart)),
                                        endTime: formatGimiTime(getTime(lastPt)),
                                        park_time_second: Math.round(finalDurSec),
                                        address: '—',
                                        lat: stopAnchor.lat,
                                        lng: stopAnchor.lng,
                                        _derived: true,
                                    });
                                }
                                console.log('[Reports] Derived', derivedStops.length, 'stops from', points.length, 'track points');
                                rawParking = derivedStops;
                            }
                        } catch (err) {
                            console.error('[Reports] Track history stop derivation failed:', err);
                        }
                    }

                    if (rawParking.length > 0) {
                        const records = rawParking.map((item: any, index: number) => {
                            // Use Math.round(Number()) instead of parseInt() — handles float seconds correctly
                            const seconds = Math.round(Number(item.park_time_second || item.durSecond || item.dur_second || item.parkTimeSecond || 0));
                            let durationStr = (!item._derived && (item.park_time || item.duration)) ? (item.park_time || item.duration) : '';
                            if (!durationStr && seconds > 0) {
                                const hours = Math.floor(seconds / 3600);
                                const mins = Math.floor((seconds % 3600) / 60);
                                durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                            }
                            if (!durationStr) durationStr = '—';

                            // Apply minStopDuration filter (in minutes)
                            if (minStopDuration > 0 && seconds < minStopDuration * 60) return null;

                            // Format times: API records use formatGimiTime (UTC→local); derived records are pre-formatted
                            const displayStart = item._derived
                                ? (item.startTime || '—')
                                : formatGimiTime(item.startTime || item.start_time) || '—';
                            const displayEnd = item._derived
                                ? (item.endTime || '—')
                                : formatGimiTime(item.endTime || item.end_time) || '—';

                            return {
                                id: `park-${index}`,
                                deviceName: targetDeviceName,
                                startTime: displayStart,
                                endTime: displayEnd,
                                duration: durationStr,
                                location: item.address || item.addr || '—',
                                lat: Number(item.lat || item.latitude || 0) || undefined,
                                lng: Number(item.lng || item.lon || item.longitude || 0) || undefined,
                                idleTimeSec: seconds,
                                accType: item._derived ? 'derived' : (accType === 'all' ? 'off' : accType),
                                imei: singleImei || item.imei || item.deviceImei || item.device_imei || (devices.find(d => d.deviceName === targetDeviceName)?.imei) || '',
                            } as ParkingData;
                        }).filter(Boolean) as ParkingData[];
                        console.log('[Reports] setParkingResult called with', records.length, 'records');
                        setParkingResult(records);

                        // Reverse geocode stops that have coordinates but no address
                        // Uses OpenStreetMap Nominatim (free, no API key needed)
                        // Rate limit: max 1 req/sec — fills addresses progressively in background
                        const geocodeInBackground = async (initialRecords: ParkingData[]) => {
                            const working = [...initialRecords];
                            for (let i = 0; i < working.length; i++) {
                                const rec = working[i];
                                if (rec.lat && rec.lng && (!rec.location || rec.location === '—')) {
                                    try {
                                        const geoRes = await fetch(
                                            `https://nominatim.openstreetmap.org/reverse?lat=${rec.lat}&lon=${rec.lng}&format=json&accept-language=en`,
                                            { headers: { 'Accept-Language': 'en' } }
                                        );
                                        const geoData = await geoRes.json();
                                        if (geoData?.address) {
                                            const a = geoData.address;
                                            // Build concise address: Road/Suburb, District, City
                                            const parts = [
                                                a.road || a.pedestrian || a.footway || a.path || '',
                                                a.suburb || a.neighbourhood || a.quarter || '',
                                                a.city || a.town || a.village || a.county || '',
                                            ].filter(Boolean);
                                            working[i] = { ...rec, location: parts.join(', ') || geoData.display_name?.split(',').slice(0, 2).join(',') || '—' };
                                            // Update state progressively so user sees addresses fill in
                                            setParkingResult([...working]);
                                        }
                                    } catch (_) { /* ignore geocoding errors silently */ }
                                    // Nominatim rate limit: 1 req/sec
                                    await new Promise(r => setTimeout(r, 1100));
                                }
                            }
                        };
                        geocodeInBackground(records);
                    } else {
                        setParkingResult([]);
                    }

                } else {
                    // Alarms Report
                    const imeiParam = singleImei || devices.map(d => d.imei).join(',');
                    if (!imeiParam) throw new Error("No device IMEIs available to query.");

                    const res = await gimiService.getDeviceAlarms(accessToken, imeiParam, startApiTime, endApiTime) as any;
                    let rawAlarms: any[] = [];
                    if (res) {
                        if (Array.isArray(res.result)) {
                            rawAlarms = res.result;
                        } else if (res.result && Array.isArray((res.result as any).list)) {
                            rawAlarms = (res.result as any).list;
                        } else if (res.result && Array.isArray((res.result as any).rows)) {
                            rawAlarms = (res.result as any).rows;
                        } else if (Array.isArray(res.data)) {
                            rawAlarms = res.data;
                        } else if (res.data && Array.isArray(res.data.list)) {
                            rawAlarms = res.data.list;
                        } else if (res.data && Array.isArray(res.data.rows)) {
                            rawAlarms = res.data.rows;
                        }
                    }

                    if (rawAlarms.length > 0) {
                        const records = rawAlarms.map((item: any, index: number) => {
                            const dev = devices.find(d => d.imei === item.imei);
                            const devName = dev ? dev.deviceName : (item.imei || '—');
                            return {
                                id: `alarm-api-${index}`,
                                deviceName: devName,
                                time: item.alarm_time || item.alarmTime || item.gpsTime || item.alertTime || '—',
                                type: item.alarm_type_name || item.alarmTypeName || item.alarm_type || item.alarmType || item.alertType || item.type || '—',
                                speed: parseFloat(item.speed || 0),
                                location: item.address || item.addr || (item.lat && item.lng ? `Lat: ${item.lat}, Lng: ${item.lng}` : '—'),
                                lat: parseFloat(item.lat || item.latitude || 0),
                                lng: parseFloat(item.lng || item.longitude || 0),
                                imei: item.imei || singleImei || '',
                            };
                        });
                        setAlarmsResult(records);
                    } else {
                        setAlarmsResult([]);
                    }
                }
            }
        } catch (err: any) {
            console.error("Report generation failed:", err);
            setError(err.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    // Auto-generate on mount / initial load / filter changes that affect API call
    useEffect(() => {
        handleGenerate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportType, accType]);

    // --- Statistics Calculations ---
    // --- Local Filter Hooks ---
    const filteredTrips = useMemo(() => {
        return tripsResult.filter(item => {
            if (minTripDistance > 0 && item.mileage < minTripDistance) {
                return false;
            }
            return true;
        });
    }, [tripsResult, minTripDistance]);

    const filteredParking = useMemo(() => {
        return parkingResult.filter(item => {
            // Don't filter out derived stops (BEACON GPS fallback) by acc_type — they have no ignition state
            if (accType !== 'all' && item.accType && item.accType !== 'derived' && item.accType !== accType) {
                return false;
            }
            const durationMins = item.idleTimeSec / 60;
            if (minStopDuration > 0 && durationMins < minStopDuration) {
                return false;
            }
            return true;
        });
    }, [parkingResult, accType, minStopDuration]);

    const filteredAlarms = useMemo(() => {
        return alarmsResult.filter(item => {
            if (selectedAlarmType === 'all') return true;
            const typeLower = item.type.toLowerCase();
            if (selectedAlarmType === 'overspeed') {
                return typeLower.includes('speed') || item.type.includes('سرعة');
            }
            if (selectedAlarmType === 'geofence') {
                return typeLower.includes('fence') || item.type.includes('سياج');
            }
            if (selectedAlarmType === 'battery') {
                return typeLower.includes('battery') || item.type.includes('بطارية');
            }
            if (selectedAlarmType === 'vibration') {
                return typeLower.includes('vibration') || item.type.includes('اهتزاز');
            }
            return true;
        });
    }, [alarmsResult, selectedAlarmType]);

    // --- Statistics Calculations ---
    const statsSummary = useMemo(() => {
        if (reportType === 'trips') {
            const totalDistance = filteredTrips.reduce((sum, item) => sum + item.mileage, 0);
            const maxSpeed = Math.max(...filteredTrips.map(item => item.maxSpeed), 0);
            const avgSpeed = filteredTrips.length > 0
                ? Math.round(filteredTrips.reduce((sum, item) => sum + item.avgSpeed, 0) / filteredTrips.length)
                : 0;

            return {
                totalDistance: `${totalDistance.toFixed(1)} km`,
                maxSpeed: `${maxSpeed} km/h`,
                avgSpeed: `${avgSpeed} km/h`,
                totalCount: filteredTrips.length
            };
        } else if (reportType === 'parking') {
            const totalStops = filteredParking.length;
            const totalSecs = filteredParking.reduce((sum, item) => sum + item.idleTimeSec, 0);
            const totalHours = Math.floor(totalSecs / 3600);
            const totalMins = Math.floor((totalSecs % 3600) / 60);

            return {
                totalStops,
                stopDuration: `${totalHours}h ${totalMins}m`,
                avgDuration: totalStops > 0 ? `${Math.round(totalSecs / totalStops / 60)} mins` : '0 mins'
            };
        } else {
            const totalAlarms = filteredAlarms.length;
            const batteryCount = filteredAlarms.filter(a => a.type.toLowerCase().includes('battery') || a.type.includes('بطارية')).length;
            const geofenceCount = filteredAlarms.filter(a => a.type.toLowerCase().includes('fence') || a.type.includes('سياج')).length;

            return {
                totalAlarms,
                batteryCount,
                geofenceCount,
                otherCount: totalAlarms - batteryCount - geofenceCount
            };
        }
    }, [reportType, filteredTrips, filteredParking, filteredAlarms]);

    // --- Chart Data Processing ---
    const chartData = useMemo(() => {
        if (reportType === 'trips') {
            // Group mileage by start date
            const groups: { [key: string]: number } = {};
            filteredTrips.forEach(t => {
                const day = t.startTime.split(' ')[0];
                groups[day] = (groups[day] || 0) + t.mileage;
            });
            return Object.keys(groups).map(day => ({
                name: day.slice(5), // show MM-DD
                [t('reports.stats.totalDistance')]: parseFloat(groups[day].toFixed(1)),
            }));
        } else if (reportType === 'parking') {
            // Group stops count by day
            const groups: { [key: string]: number } = {};
            filteredParking.forEach(p => {
                const day = p.startTime.split(' ')[0];
                groups[day] = (groups[day] || 0) + 1;
            });
            return Object.keys(groups).map(day => ({
                name: day.slice(5),
                [t('reports.stats.totalStops')]: groups[day],
            }));
        } else {
            // Alarm types counts for Pie Chart
            const counts: { [key: string]: number } = {};
            filteredAlarms.forEach(a => {
                counts[a.type] = (counts[a.type] || 0) + 1;
            });
            return Object.keys(counts).map(key => ({
                name: key,
                value: counts[key]
            }));
        }
    }, [reportType, filteredTrips, filteredParking, filteredAlarms, t]);

    // Colors for Recharts Pie
    const COLORS = ['#0891b2', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899'];

    // --- Table Filtering & Search ---
    const filteredTableData = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (reportType === 'trips') {
            return filteredTrips.filter(item =>
                item.deviceName.toLowerCase().includes(query) ||
                item.startLocation.toLowerCase().includes(query) ||
                item.endLocation.toLowerCase().includes(query)
            );
        } else if (reportType === 'parking') {
            return filteredParking.filter(item =>
                item.deviceName.toLowerCase().includes(query) ||
                item.location.toLowerCase().includes(query)
            );
        } else {
            return filteredAlarms.filter(item =>
                item.deviceName.toLowerCase().includes(query) ||
                item.type.toLowerCase().includes(query) ||
                item.location.toLowerCase().includes(query)
            );
        }
    }, [reportType, searchQuery, filteredTrips, filteredParking, filteredAlarms]);

    // Paginated dataset
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredTableData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredTableData, currentPage]);

    const totalPages = Math.ceil(filteredTableData.length / itemsPerPage);

    // --- CSV Export Logic ---
    const handleExportCsv = () => {
        let headers: string[] = [];
        let rows: string[][] = [];
        const filename = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;

        if (reportType === 'trips') {
            headers = [
                t('reports.table.device'),
                t('reports.table.startTime'),
                t('reports.table.endTime'),
                t('reports.table.location') + " (Start)",
                t('reports.table.location') + " (End)",
                t('reports.table.mileage') + " (km)",
                t('reports.table.duration')
            ];
            rows = (filteredTableData as TripData[]).map(t => [
                t.deviceName,
                t.startTime,
                t.endTime,
                t.startLocation,
                t.endLocation,
                t.mileage.toString(),
                t.duration
            ]);
        } else if (reportType === 'parking') {
            headers = [
                t('reports.table.device'),
                t('reports.table.startTime'),
                t('reports.table.endTime'),
                t('reports.table.duration'),
                t('reports.table.location'),
                'Coordinates'
            ];
            rows = (filteredTableData as ParkingData[]).map(p => [
                p.deviceName,
                p.startTime,
                p.endTime,
                p.duration,
                p.location,
                (p.lat && p.lng) ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : '—'
            ]);
        } else {
            headers = [
                t('reports.table.device'),
                t('reports.table.time'),
                t('reports.table.type'),
                t('reports.table.location')
            ];
            rows = (filteredTableData as AlarmData[]).map(a => [
                a.deviceName,
                a.time,
                a.type,
                a.location
            ]);
        }

        // Add BOM character so Excel opens Arabic correctly in UTF-8
        let csvContent = "\uFEFF";
        csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
        rows.forEach(row => {
            csvContent += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{
            padding: '24px',
            flex: 1,
            overflowY: 'auto',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            direction: isRtl ? 'rtl' : 'ltr'
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* --- Page Header --- */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="glass-panel" style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={22} color="var(--accent)" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>{t('reports.title')}</h1>
                            <p style={{ color: 'var(--text-secondary)', margin: '2px 0 0 0', fontSize: '13px' }}>
                                {t('auth.subtitle')} — {devices.length} {t('nav.devices')}
                            </p>
                        </div>
                    </div>

                    {/* Simulation Switch */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {isRtl ? 'بيانات محاكاة' : 'Simulated Data'}
                        </span>
                        <button
                            onClick={() => {
                                setSimulationMode(!simulationMode);
                                // Trigger reload with changed source
                                setTimeout(() => handleGenerate(), 100);
                            }}
                            className="sx-btn"
                            style={{
                                padding: '6px 12px',
                                fontSize: '11px',
                                background: simulationMode ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${simulationMode ? 'var(--accent)' : 'var(--border)'}`,
                                color: simulationMode ? 'var(--accent)' : 'var(--text-secondary)',
                                borderRadius: '18px'
                            }}
                        >
                            {simulationMode ? (isRtl ? 'تشغيل' : 'ON') : (isRtl ? 'إيقاف' : 'OFF')}
                        </button>
                    </div>
                </div>

                {/* --- Filters Panel --- */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Report Type Tabs */}
                    <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '4px', gap: '4px' }}>
                        <button
                            onClick={() => setReportType('trips')}
                            className="sx-btn"
                            style={{
                                flex: 1, padding: '8px', fontSize: '13px', borderRadius: 'var(--radius-sm)',
                                background: reportType === 'trips' ? 'var(--accent)' : 'transparent',
                                color: reportType === 'trips' ? '#0a0f1d' : 'var(--text-secondary)',
                                fontWeight: reportType === 'trips' ? 600 : 400
                            }}
                        >
                            {t('reports.types.trips')}
                        </button>
                        <button
                            onClick={() => setReportType('parking')}
                            className="sx-btn"
                            style={{
                                flex: 1, padding: '8px', fontSize: '13px', borderRadius: 'var(--radius-sm)',
                                background: reportType === 'parking' ? 'var(--accent)' : 'transparent',
                                color: reportType === 'parking' ? '#0a0f1d' : 'var(--text-secondary)',
                                fontWeight: reportType === 'parking' ? 600 : 400
                            }}
                        >
                            {t('reports.types.parking')}
                        </button>
                        <button
                            onClick={() => setReportType('alarms')}
                            className="sx-btn"
                            style={{
                                flex: 1, padding: '8px', fontSize: '13px', borderRadius: 'var(--radius-sm)',
                                background: reportType === 'alarms' ? 'var(--accent)' : 'transparent',
                                color: reportType === 'alarms' ? '#0a0f1d' : 'var(--text-secondary)',
                                fontWeight: reportType === 'alarms' ? 600 : 400
                            }}
                        >
                            {t('reports.types.alarms')}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                        {/* Device dropdown */}
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                {t('reports.device')}
                            </label>
                            <select
                                value={selectedImei}
                                onChange={(e) => setSelectedImei(e.target.value)}
                                className="sx-select"
                                style={{ background: 'var(--bg-primary)' }}
                            >
                                <option value="all">{t('reports.allDevices')}</option>
                                {devices.map((d) => (
                                    <option key={d.imei} value={d.imei}>{d.deviceName} ({d.imei})</option>
                                ))}
                            </select>
                        </div>

                        {/* Start date */}
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                {t('reports.startDate')}
                            </label>
                            <input
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="sx-input"
                                style={{ background: 'var(--bg-primary)' }}
                            />
                        </div>

                        {/* End date */}
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                {t('reports.endDate')}
                            </label>
                            <input
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="sx-input"
                                style={{ background: 'var(--bg-primary)' }}
                            />
                        </div>

                        {/* Trips Filters */}
                        {reportType === 'trips' && (
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                    {t('reports.filters.minTripDistance')}
                                </label>
                                <select
                                    value={minTripDistance}
                                    onChange={(e) => {
                                        setMinTripDistance(parseFloat(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="sx-select"
                                    style={{ background: 'var(--bg-primary)' }}
                                >
                                    <option value="0">{t('alertsFilters.all')}</option>
                                    <option value="0.5">&gt; 0.5 km</option>
                                    <option value="1">&gt; 1 km</option>
                                    <option value="5">&gt; 5 km</option>
                                    <option value="10">&gt; 10 km</option>
                                    <option value="50">&gt; 50 km</option>
                                </select>
                            </div>
                        )}

                        {/* Parking Duration Filter */}
                        {reportType === 'parking' && (
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                    {t('reports.filters.minStopDuration')}
                                </label>
                                <select
                                    value={minStopDuration}
                                    onChange={(e) => {
                                        setMinStopDuration(parseInt(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="sx-select"
                                    style={{ background: 'var(--bg-primary)' }}
                                >
                                    <option value="0">{t('alertsFilters.all')}</option>
                                    <option value="2">&gt; 2 {isRtl ? 'دقائق' : 'mins'}</option>
                                    <option value="5">&gt; 5 {isRtl ? 'دقائق' : 'mins'}</option>
                                    <option value="10">&gt; 10 {isRtl ? 'دقائق' : 'mins'}</option>
                                    <option value="30">&gt; 30 {isRtl ? 'دقيقة' : 'mins'}</option>
                                    <option value="60">&gt; 1 {isRtl ? 'ساعة' : 'hour'}</option>
                                </select>
                            </div>
                        )}

                        {/* Alarm Category Filter */}
                        {reportType === 'alarms' && (
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                    {t('reports.filters.alarmType')}
                                </label>
                                <select
                                    value={selectedAlarmType}
                                    onChange={(e) => {
                                        setSelectedAlarmType(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="sx-select"
                                    style={{ background: 'var(--bg-primary)' }}
                                >
                                    <option value="all">{t('reports.filters.allAlarms')}</option>
                                    <option value="overspeed">{isRtl ? 'سرعة زائدة' : 'Overspeed'}</option>
                                    <option value="geofence">{isRtl ? 'سياج جغرافي' : 'Geofence'}</option>
                                    <option value="battery">{isRtl ? 'البطارية' : 'Battery'}</option>
                                    <option value="vibration">{isRtl ? 'الاهتزاز' : 'Vibration'}</option>
                                </select>
                            </div>
                        )}

                        {/* Generate/Export buttons */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="sx-btn sx-btn-primary"
                                style={{ flex: 1, padding: '10px 14px' }}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        {t('common.loading')}
                                    </>
                                ) : (
                                    t('reports.generate')
                                )}
                            </button>
                            <button
                                onClick={handleExportCsv}
                                disabled={loading || (reportType === 'trips' && tripsResult.length === 0) || (reportType === 'parking' && parkingResult.length === 0) || (reportType === 'alarms' && alarmsResult.length === 0)}
                                className="sx-btn sx-btn-ghost"
                                title={t('reports.export')}
                                style={{ padding: '10px 12px' }}
                            >
                                <Download size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Warning Alert if real API is called and credentials not set */}
                {error && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '10px'
                    }}>
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* --- Summary Statistics --- */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    {reportType === 'trips' && (
                        <>
                            <div className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('reports.stats.totalDistance')}</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--accent)' }}>{statsSummary.totalDistance}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isRtl ? 'إجمالي الرحلات' : 'Total Trips'}</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--online)' }}>{statsSummary.totalCount}</div>
                            </div>
                        </>
                    )}

                    {reportType === 'parking' && (
                        <>
                            <div className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('reports.stats.totalStops')}</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--accent)' }}>{statsSummary.totalStops}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('reports.stats.stopDuration')}</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--warning)' }}>{statsSummary.stopDuration}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isRtl ? 'متوسط مدة التوقف' : 'Avg Stop Duration'}</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--online)' }}>{statsSummary.avgDuration}</div>
                            </div>
                        </>
                    )}

                    {reportType === 'alarms' && (
                        <>
                            <div className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('reports.stats.totalAlarms')}</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--danger)' }}>{statsSummary.totalAlarms}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isRtl ? 'تنبيهات انخفاض البطارية' : 'Battery Alarms'}</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--warning)' }}>{statsSummary.batteryCount}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isRtl ? 'تنبيهات السياج الجغرافي' : 'Geofence Alarms'}</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--accent)' }}>{statsSummary.geofenceCount}</div>
                            </div>
                        </>
                    )}
                </div>

                {/* --- Visualization Charts --- */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                    {/* Main Analytics Graph */}
                    <div className="glass-panel" style={{ padding: '20px', minHeight: '340px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={16} color="var(--accent)" />
                            {reportType === 'trips' && (isRtl ? 'مخطط المسافات اليومية' : 'Daily Distance Chart')}
                            {reportType === 'parking' && (isRtl ? 'تكرار التوقفات اليومية' : 'Daily Stops Frequency')}
                            {reportType === 'alarms' && (isRtl ? 'توزيع أنواع التنبيهات' : 'Alarms Types Distribution')}
                        </h3>

                        <div style={{ flex: 1, minHeight: '260px' }}>
                            {chartData.length === 0 ? (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    {t('reports.noData')}
                                </div>
                            ) : reportType === 'trips' ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                        <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                                        <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px' }} />
                                        <Line type="monotone" dataKey={t('reports.stats.totalDistance')} stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : reportType === 'parking' ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                        <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                                        <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px' }} />
                                        <Bar dataKey={t('reports.stats.totalStops')} fill="var(--accent)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexWrap: 'wrap', gap: '24px' }}>
                                    <ResponsiveContainer width="50%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={4}
                                                dataKey="value"
                                            >
                                                {chartData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '40%' }}>
                                        {chartData.map((entry, index) => (
                                            <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '2px', background: COLORS[index % COLORS.length] }} />
                                                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                                                <span style={{ fontWeight: 700 }}>({entry.value})</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Overview Summary Card */}
                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldAlert size={16} color="var(--accent)" />
                            {isRtl ? 'ملخص النشاط التنفيذي' : 'Executive Activity Summary'}
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                            {isRtl
                                ? 'تحليل رقمي تم إنشاؤه تلقائيًا بناءً على إحداثيات GPS ونشاط الأسطول للفترة المحددة.'
                                : 'Automated analytical summary generated based on GPS coordinates and fleet activity metrics for the selected time range.'}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                            {reportType === 'trips' && [
                                `${isRtl ? 'إجمالي الرحلات المسجلة' : 'Total recorded trips'}: ${tripsResult.length}`,
                                `${isRtl ? 'المسافة المقطوعة الكلية' : 'Cumulative distance'}: ${statsSummary.totalDistance}`,
                            ].map((text, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--online)', fontWeight: 'bold' }}>✓</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
                                </div>
                            ))}

                            {reportType === 'parking' && [
                                `${isRtl ? 'إجمالي عدد مرات الوقوف' : 'Total parking stops'}: ${statsSummary.totalStops}`,
                                `${isRtl ? 'إجمالي زمن التوقف' : 'Total stop duration'}: ${statsSummary.stopDuration}`,
                                `${isRtl ? 'متوسط مدة الوقوف لكل مركبة' : 'Average stop duration'}: ${statsSummary.avgDuration}`,
                            ].map((text, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--online)', fontWeight: 'bold' }}>✓</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
                                </div>
                            ))}

                            {reportType === 'alarms' && [
                                `${isRtl ? 'إجمالي التنبيهات والأعطال' : 'Total alarms triggered'}: ${statsSummary.totalAlarms}`,
                                `${isRtl ? 'تنبيهات انخفاض البطارية' : 'Battery alerts'}: ${statsSummary.batteryCount}`,
                                `${isRtl ? 'تنبيهات السياجات الجغرافية' : 'Geofence boundary alerts'}: ${statsSummary.geofenceCount}`,
                            ].map((text, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--online)', fontWeight: 'bold' }}>✓</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- Data Table --- */}
                <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Table Toolbar */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                            {isRtl ? 'جدول البيانات التفصيلي' : 'Detailed Records'}
                            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginInlineStart: '8px' }}>
                                ({filteredTableData.length} {isRtl ? 'سجل' : 'records'})
                            </span>
                        </h3>

                        {/* Search Input */}
                        <div style={{ position: 'relative', width: '240px' }}>
                            <Search size={14} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '12px', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder={t('common.search')}
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="sx-input"
                                style={{ paddingInlineStart: '34px', fontSize: '13px', height: '36px', background: 'var(--bg-primary)' }}
                            />
                        </div>
                    </div>

                    {/* Responsive Table */}
                    <div style={{ overflowX: 'auto' }}>
                        {filteredTableData.length === 0 ? (
                            <div style={{ padding: '40px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                {t('reports.noData')}
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: isRtl ? 'right' : 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.01)' }}>
                                        <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.device')}</th>
                                        {reportType === 'trips' && (
                                            <>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.startTime')}</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.endTime')}</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.location')} ({isRtl ? 'البداية' : 'Start'})</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.location')} ({isRtl ? 'النهاية' : 'End'})</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.mileage')}</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.duration')}</th>
                                            </>
                                        )}
                                        {reportType === 'parking' && (
                                            <>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.startTime')}</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.endTime')}</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.duration')}</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.location')}</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>Coordinates</th>
                                            </>
                                        )}
                                        {reportType === 'alarms' && (
                                            <>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.time')}</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.type')}</th>
                                                <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.table.location')}</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row) => (
                                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }} className="hover:bg-white/[0.02]">
                                            <td style={{ padding: '12px 20px', fontWeight: 600 }}>
                                                {row.imei ? (
                                                    <button
                                                        onClick={() => {
                                                            const dev = devices.find(d => d.imei === row.imei);
                                                            if (dev) {
                                                                useDeviceStore.getState().selectDevice(dev);
                                                                navigate('/');
                                                            }
                                                        }}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            padding: 0,
                                                            color: 'var(--accent)',
                                                            cursor: 'pointer',
                                                            fontWeight: 600,
                                                            textAlign: isRtl ? 'right' : 'left',
                                                            fontSize: 'inherit',
                                                            fontFamily: 'inherit'
                                                        }}
                                                        className="hover:underline"
                                                        title={isRtl ? "عرض على الخريطة المباشرة" : "Show on Live Map"}
                                                    >
                                                        {row.deviceName}
                                                    </button>
                                                ) : (
                                                    row.deviceName
                                                )}
                                            </td>
                                            {reportType === 'trips' && (
                                                <>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as TripData).startTime}</td>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as TripData).endTime}</td>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        {(row as TripData).startLat && (row as TripData).startLng ? (
                                                            <a
                                                                href={`https://www.google.com/maps?q=${(row as TripData).startLat},${(row as TripData).startLng}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                                                                className="hover:underline hover:text-[var(--accent)]"
                                                                title={isRtl ? "عرض البداية على خريطة جوجل" : "Show start on Google Maps"}
                                                            >
                                                                📍 {(row as TripData).startLocation}
                                                            </a>
                                                        ) : (
                                                            (row as TripData).startLocation
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        {(row as TripData).endLat && (row as TripData).endLng ? (
                                                            <a
                                                                href={`https://www.google.com/maps?q=${(row as TripData).endLat},${(row as TripData).endLng}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                                                                className="hover:underline hover:text-[var(--accent)]"
                                                                title={isRtl ? "عرض النهاية على خريطة جوجل" : "Show end on Google Maps"}
                                                            >
                                                                📍 {(row as TripData).endLocation}
                                                            </a>
                                                        ) : (
                                                            (row as TripData).endLocation
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 20px', color: 'var(--accent)', fontWeight: 600 }}>{(row as TripData).mileage.toFixed(1)} km</td>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as TripData).duration}</td>
                                                </>
                                            )}
                                            {reportType === 'parking' && (
                                                <>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as ParkingData).startTime}</td>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as ParkingData).endTime}</td>
                                                    <td style={{ padding: '12px 20px', color: 'var(--warning)', fontWeight: 600 }}>{(row as ParkingData).duration}</td>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        {(row as ParkingData).lat && (row as ParkingData).lng ? (
                                                            <a
                                                                href={`https://www.google.com/maps?q=${(row as ParkingData).lat},${(row as ParkingData).lng}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                                                                className="hover:underline hover:text-[var(--accent)]"
                                                                title={isRtl ? "عرض على خريطة جوجل" : "Show on Google Maps"}
                                                            >
                                                                📍 {(row as ParkingData).location}
                                                            </a>
                                                        ) : (
                                                            (row as ParkingData).location
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        {(row as ParkingData).lat && (row as ParkingData).lng ? (
                                                            <a
                                                                href={`https://www.google.com/maps?q=${(row as ParkingData).lat},${(row as ParkingData).lng}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '12px', textDecoration: 'none' }}
                                                                title="Open in Google Maps"
                                                            >
                                                                📍 {(row as ParkingData).lat!.toFixed(5)}, {(row as ParkingData).lng!.toFixed(5)}
                                                            </a>
                                                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                    </td>
                                                </>
                                            )}
                                            {reportType === 'alarms' && (
                                                <>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as AlarmData).time}</td>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        <span className={`badge ${
                                                            (row as AlarmData).type.toLowerCase().includes('speed') || (row as AlarmData).type.includes('سرعة')
                                                                ? 'badge-danger'
                                                                : (row as AlarmData).type.toLowerCase().includes('fence') || (row as AlarmData).type.includes('سياج')
                                                                ? 'badge-warning'
                                                                : 'badge-offline'
                                                        }`}>
                                                            {(row as AlarmData).type}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        {(row as AlarmData).lat && (row as AlarmData).lng ? (
                                                            <a
                                                                href={`https://www.google.com/maps?q=${(row as AlarmData).lat},${(row as AlarmData).lng}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
                                                                className="hover:underline hover:text-[var(--accent)]"
                                                                title={isRtl ? "عرض على خريطة جوجل" : "Show on Google Maps"}
                                                            >
                                                                📍 {(row as AlarmData).location}
                                                            </a>
                                                        ) : (
                                                            (row as AlarmData).location
                                                        )}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Table Pagination Controls */}
                    {totalPages > 1 && (
                        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {isRtl
                                    ? `صفحة ${currentPage} من ${totalPages}`
                                    : `Page ${currentPage} of ${totalPages}`}
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="sx-btn sx-btn-ghost sx-btn-sm"
                                >
                                    {isRtl ? 'السابق' : 'Previous'}
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="sx-btn sx-btn-ghost sx-btn-sm"
                                >
                                    {isRtl ? 'التالي' : 'Next'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
