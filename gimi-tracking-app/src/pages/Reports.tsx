/**
 * Reports Page
 * 
 * Note: UTC time conversion is handled via `formatToUtcApiTime` in `src/utils/time.ts`,
 * which performs getUTCFullYear, getUTCMonth, getUTCDate, and getUTCHours conversions.
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { useDeviceStore } from '../store/devices';
import { gimiService } from '../services/gimi';
import { formatGimiTime, getLocalIsoString, formatToUtcApiTime } from '../utils/time';
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
}

interface ParkingData {
    id: string;
    deviceName: string;
    startTime: string;
    endTime: string;
    duration: string;
    location: string;
    idleTimeSec: number;
    accType?: 'on' | 'off';
}

interface AlarmData {
    id: string;
    deviceName: string;
    time: string;
    type: string;
    speed: number;
    location: string;
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
    const getMockTrips = (deviceName: string, startStr: string, endStr: string): TripData[] => {
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
                startTime: tripStart.toISOString().replace('T', ' ').slice(0, 19),
                endTime: tripEnd.toISOString().replace('T', ' ').slice(0, 19),
                startLocation: locations[i % locations.length],
                endLocation: locations[(i + 1) % locations.length],
                mileage: distance,
                duration: `${hours}h ${mins}m`,
                avgSpeed: Math.round(30 + Math.random() * 45),
                maxSpeed: Math.round(80 + Math.random() * 40),
            });
        }
        return mockTrips;
    };

    const getMockParking = (deviceName: string, startStr: string, endStr: string): ParkingData[] => {
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
                startTime: stopStart.toISOString().replace('T', ' ').slice(0, 19),
                endTime: stopEnd.toISOString().replace('T', ' ').slice(0, 19),
                duration: `${hours}h ${mins}m`,
                location: locations[i % locations.length] + (isAccOn ? (isRtl ? " (ACC ON - تشغيل)" : " (ACC ON)") : ""),
                idleTimeSec: Math.floor(durationMs / 1000),
                accType: isAccOn ? 'on' : 'off'
            });
        }
        return mockParking;
    };

    const getMockAlarms = (deviceName: string, startStr: string, endStr: string): AlarmData[] => {
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
                time: alarmTime.toISOString().replace('T', ' ').slice(0, 19),
                type: alarmTypes[i % alarmTypes.length],
                speed: i % 2 === 0 ? Math.round(122 + Math.random() * 25) : 0,
                location: locations[i % locations.length],
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
                // Generate mock records
                if (reportType === 'trips') {
                    const mock = getMockTrips(targetDeviceName, startDate, endDate);
                    setTripsResult(mock);
                } else if (reportType === 'parking') {
                    const mock = getMockParking(targetDeviceName, startDate, endDate);
                    setParkingResult(mock);
                } else {
                    const mock = getMockAlarms(targetDeviceName, startDate, endDate);
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
                    const [res, ...mileageResults] = await Promise.all([
                        gimiService.getTripsReport(
                            accessToken,
                            userId || '',
                            imeiParam,
                            startApiTime,
                            endApiTime
                        ),
                        // Call mileage API for each IMEI (same API the History page uses for accurate distance)
                        ...imeiList.map(imei =>
                            gimiService.getTrackMileage(accessToken, imei, startApiTime, endApiTime)
                                .catch(() => null)
                        )
                    ]) as any[];

                    // Build a lookup of IMEI → mileage (km) from the mileage API
                    const mileageLookup: Record<string, number> = {};
                    imeiList.forEach((imei, idx) => {
                        const mRes = mileageResults[idx];
                        if (!mRes) return;
                        let mileageVal = 0;
                        if (Array.isArray(mRes?.result) && mRes.result.length > 0) {
                            mileageVal = mRes.result[0].mileage;
                        } else if (mRes?.result?.mileage !== undefined) {
                            mileageVal = mRes.result.mileage;
                        } else if (mRes?.data && Array.isArray(mRes.data) && mRes.data.length > 0) {
                            mileageVal = mRes.data[0].mileage;
                        }
                        // Mileage API returns value in meters → convert to km
                        mileageLookup[imei] = Number(mileageVal || 0) / 1000;
                    });

                    // The API returns result (array of trips) or data (array of trips)
                    const tripsList = (res as any)?.result || (res as any)?.data || [];
                    const rawTrips = Array.isArray(tripsList) ? tripsList : (tripsList?.tripsData || tripsList?.dayList || []);

                    if (rawTrips.length > 0) {
                        // Reverse-geocode start/end coordinates for each trip
                        const records: TripData[] = await Promise.all(
                            rawTrips.map(async (item: any, index: number) => {
                                const itemImei = item.imei || item.deviceImei || item.device_imei || item.device_no || item.deviceNo;
                                const targetImei = itemImei || (singleImei && singleImei !== 'all' ? singleImei : '');
                                const dev = devices.find(d => d.imei === (itemImei || targetImei));
                                const devName = dev ? dev.deviceName : (itemImei || targetDeviceName);

                                const startLat = parseFloat(item.startLat || item.start_lat || 0);
                                const startLng = parseFloat(item.startLng || item.start_lng || 0);
                                const endLat = parseFloat(item.endLat || item.end_lat || 0);
                                const endLng = parseFloat(item.endLng || item.end_lng || 0);

                                // --- Distance resolution (multi-strategy, same as History page) ---
                                let distKm = 0;

                                // Strategy 1: Use the trips API distance field
                                const distRaw = parseFloat(item.distance || item.totalMileage || item.mileage || 0);
                                if (distRaw > 0) {
                                    // Heuristic: if value > 100, it's likely meters; otherwise km
                                    distKm = distRaw > 100 ? distRaw / 1000 : distRaw;
                                }

                                // Strategy 2: If trips API returned 0 and we only have 1 IMEI,
                                // use the mileage API result (divided across trips proportionally)
                                if (distKm <= 0 && targetImei && mileageLookup[targetImei] > 0) {
                                    // For single trip, use full mileage; for multiple, distribute evenly as approximation
                                    const tripsForImei = rawTrips.filter((t: any) =>
                                        (t.imei || t.deviceImei || t.device_imei || t.device_no || t.deviceNo || singleImei) === targetImei
                                    );
                                    distKm = mileageLookup[targetImei] / Math.max(1, tripsForImei.length);
                                }

                                // Timestamps for display and fallback
                                const rawStart = item.startTime || item.start_time || item.enterTime || item.enter_time;
                                const rawEnd = item.endTime || item.end_time || item.exitTime || item.exit_time;
                                const displayStart = formatGimiTime(rawStart);
                                const displayEnd = formatGimiTime(rawEnd);

                                // Strategy 3: Fetch track points and compute Haversine distance
                                // Use the RAW UTC times (not display local times) for the API call
                                if (distKm <= 0 && rawStart && rawEnd && targetImei) {
                                    try {
                                        // rawStart/rawEnd are already in UTC format from the API (YYYY-MM-DD HH:mm:ss)
                                        // Pass them directly — do NOT use displayStart/displayEnd which are local time
                                        const trackRes = await gimiService.getTrackHistory(
                                            accessToken,
                                            targetImei,
                                            rawStart,
                                            rawEnd
                                        ) as any;

                                        const pts = trackRes?.result || trackRes?.data || [];
                                        const points = Array.isArray(pts) ? pts : (pts?.list || []);
                                        if (points.length > 0) {
                                            let calcMeters = 0;
                                            let prevPoint: any = null;
                                            for (const pt of points) {
                                                if (!pt || pt.lat === undefined || pt.lng === undefined) continue;
                                                const lat = Number(pt.lat);
                                                const lng = Number(pt.lng);
                                                if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;
                                                if (prevPoint) {
                                                    calcMeters += haversineDistance(prevPoint.lat, prevPoint.lng, lat, lng);
                                                }
                                                prevPoint = { lat, lng };
                                            }
                                            if (calcMeters > 0) {
                                                distKm = calcMeters / 1000;
                                            }
                                        }
                                    } catch (err) {
                                        console.error("Failed to fetch track history fallback for trip:", err);
                                    }
                                }

                                // Duration from seconds
                                const durSec = parseInt(item.runTimeSecond || item.elapsed || item.run_time_second || 0);
                                const hours = Math.floor(durSec / 3600);
                                const mins = Math.floor((durSec % 3600) / 60);

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
                            }]);
                        } else {
                            setTripsResult([]);
                        }
                    }
                } else if (reportType === 'parking') {
                    // Parking Report
                    if (!singleImei) {
                        throw new Error("Tracksolid Parking Report requires selecting a specific device.");
                    }
                    const res = await gimiService.getParkingReport(
                        accessToken,
                        userId || '',
                        singleImei,
                        startApiTime,
                        endApiTime,
                        accType === 'all' ? 'off' : accType
                    ) as any;
                    let rawParking: any[] = [];
                    if (res) {
                        if (Array.isArray(res.result)) {
                            rawParking = res.result;
                        } else if (res.result && Array.isArray((res.result as any).rows)) {
                            rawParking = (res.result as any).rows;
                        } else if (res.result && Array.isArray((res.result as any).list)) {
                            rawParking = (res.result as any).list;
                        } else if (Array.isArray(res.data)) {
                            rawParking = res.data;
                        } else if (res.data && Array.isArray(res.data.rows)) {
                            rawParking = res.data.rows;
                        } else if (res.data && Array.isArray(res.data.list)) {
                            rawParking = res.data.list;
                        }
                    }

                    if (rawParking.length > 0) {
                        const records = rawParking.map((item: any, index: number) => {
                            const seconds = parseInt(item.park_time_second || item.durSecond || item.dur_second || item.parkTimeSecond || 0);
                            let durationStr = item.park_time || item.duration || '';
                            if (!durationStr && seconds > 0) {
                                const hours = Math.floor(seconds / 3600);
                                const mins = Math.floor((seconds % 3600) / 60);
                                durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                            }
                            if (!durationStr) durationStr = '—';

                            return {
                                id: `park-api-${index}`,
                                deviceName: targetDeviceName,
                                startTime: item.startTime || item.start_time || '—',
                                endTime: item.endTime || item.end_time || '—',
                                duration: durationStr,
                                location: item.address || item.addr || '—',
                                idleTimeSec: seconds,
                                accType: accType === 'all' ? 'off' : accType
                            };
                        });
                        setParkingResult(records);
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
            if (accType !== 'all' && item.accType && item.accType !== accType) {
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
                t('reports.table.location')
            ];
            rows = (filteredTableData as ParkingData[]).map(p => [
                p.deviceName,
                p.startTime,
                p.endTime,
                p.duration,
                p.location
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
                                            <td style={{ padding: '12px 20px', fontWeight: 600 }}>{row.deviceName}</td>
                                            {reportType === 'trips' && (
                                                <>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as TripData).startTime}</td>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as TripData).endTime}</td>
                                                    <td style={{ padding: '12px 20px' }}>{(row as TripData).startLocation}</td>
                                                    <td style={{ padding: '12px 20px' }}>{(row as TripData).endLocation}</td>
                                                    <td style={{ padding: '12px 20px', color: 'var(--accent)', fontWeight: 600 }}>{(row as TripData).mileage.toFixed(1)} km</td>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as TripData).duration}</td>
                                                </>
                                            )}
                                            {reportType === 'parking' && (
                                                <>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as ParkingData).startTime}</td>
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as ParkingData).endTime}</td>
                                                    <td style={{ padding: '12px 20px', color: 'var(--warning)', fontWeight: 600 }}>{(row as ParkingData).duration}</td>
                                                    <td style={{ padding: '12px 20px' }}>{(row as ParkingData).location}</td>
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
                                                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{(row as AlarmData).location}</td>
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
