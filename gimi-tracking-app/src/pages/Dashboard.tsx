import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import { gimiService } from '../services/gimi';
import LiveMap, { type LiveMapHandle } from '../components/LiveMap';
import DevicePanel from '../components/DevicePanel';
import MapZoomControls from '../components/MapZoomControls';
import { useTranslation } from 'react-i18next';
import { formatGimiTimeOnly } from '../utils/time';

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

export default function Dashboard() {
    const { devices, selectedDevice } = useDeviceStore();
    const { accessToken } = useAuthStore();
    const navigate = useNavigate();
    const [todayMileage, setTodayMileage] = useState<number | null>(null);
    const [mileageLoading, setMileageLoading] = useState(false);
    const [loading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string>('');
    const [showPanel, setShowPanel] = useState(true);
    const [showMobilePanel, setShowMobilePanel] = useState(false);
    const mapRef = useRef<LiveMapHandle>(null);
    const isMobile = useIsMobile();
    const { t } = useTranslation();

    // Fetch today's mileage when selected device changes
    useEffect(() => {
        if (!accessToken || !selectedDevice?.imei) {
            setTodayMileage(null);
            return;
        }

        let isMounted = true;
        const fetchMileage = async () => {
            setMileageLoading(true);
            try {
                const now = new Date();
                
                // Helper to format Date as yyyy-MM-dd HH:mm:ss
                const format = (d: Date) => {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                };

                // Helper to format Date in UTC as yyyy-MM-dd HH:mm:ss
                const formatUTC = (d: Date) => {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
                };

                // 1. L: Local day boundaries
                const localStart = new Date(now);
                localStart.setHours(0, 0, 0, 0);
                const localEnd = new Date(now);
                localEnd.setHours(23, 59, 59, 999);
                const localBeginStr = format(localStart);
                const localEndStr = format(localEnd);

                // 2. U: UTC day boundaries (Saudi Day shifted to UTC)
                // Saudi is UTC+3, so local 00:00:00 is UTC 21:00:00 of previous day
                const saudiStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 21, 0, 0));
                const saudiEndUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 20, 59, 59));
                const utcBeginStr = formatUTC(saudiStartUTC);
                const utcEndStr = formatUTC(saudiEndUTC);

                // 3. B: Beijing day boundaries (Beijing Day shifted to UTC)
                // Beijing is UTC+8, so Beijing 00:00:00 is UTC 16:00:00 of previous day
                const bjStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 16, 0, 0));
                const bjEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 59, 59));
                const bjBeginStr = formatUTC(bjStart);
                const bjEndStr = formatUTC(bjEnd);

                // 4. RU: Raw UTC Day Range (June 7th 00:00:00 UTC to 23:59:59 UTC)
                const rawUtcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
                const rawUtcEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
                const rawUtcBeginStr = formatUTC(rawUtcStart);
                const rawUtcEndStr = formatUTC(rawUtcEnd);

                // 5. CL: Local start to current local time
                const curLocalBeginStr = format(localStart);
                const curLocalEndStr = format(now);

                // 6. CU: UTC start to current UTC time
                const curUtcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
                const curUtcBeginStr = formatUTC(curUtcStart);
                const curUtcEndStr = formatUTC(now);

                // 7. Y: Yesterday local day boundaries
                const yesterdayStart = new Date(localStart.getTime() - 24 * 60 * 60 * 1000);
                const yesterdayEnd = new Date(localEnd.getTime() - 24 * 60 * 60 * 1000);
                const yBeginStr = format(yesterdayStart);
                const yEndStr = format(yesterdayEnd);

                // 8. M30: Last 30 days local day boundaries
                const days30Start = new Date(localStart.getTime() - 30 * 24 * 60 * 60 * 1000);
                const m30BeginStr = format(days30Start);
                const m30EndStr = localEndStr;

                // Run queries in parallel
                const [rLocal, rUtc, rBj, rRawUtc, rCurLocal, rCurUtc, rY, rM30, rHP] = await Promise.all([
                    gimiService.getTrackMileage(accessToken, selectedDevice.imei, localBeginStr, localEndStr).catch(e => ({ error: e.message })),
                    gimiService.getTrackMileage(accessToken, selectedDevice.imei, utcBeginStr, utcEndStr).catch(e => ({ error: e.message })),
                    gimiService.getTrackMileage(accessToken, selectedDevice.imei, bjBeginStr, bjEndStr).catch(e => ({ error: e.message })),
                    gimiService.getTrackMileage(accessToken, selectedDevice.imei, rawUtcBeginStr, rawUtcEndStr).catch(e => ({ error: e.message })),
                    gimiService.getTrackMileage(accessToken, selectedDevice.imei, curLocalBeginStr, curLocalEndStr).catch(e => ({ error: e.message })),
                    gimiService.getTrackMileage(accessToken, selectedDevice.imei, curUtcBeginStr, curUtcEndStr).catch(e => ({ error: e.message })),
                    gimiService.getTrackMileage(accessToken, selectedDevice.imei, yBeginStr, yEndStr).catch(e => ({ error: e.message })),
                    gimiService.getTrackMileage(accessToken, selectedDevice.imei, m30BeginStr, m30EndStr).catch(e => ({ error: e.message })),
                    gimiService.getTrackHistory(accessToken, selectedDevice.imei, localBeginStr, localEndStr).catch(e => ({ error: e.message }))
                ]) as unknown[];

                if (!isMounted) return;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const parseMileage = (res: any) => {
                    let mileageVal = 0;
                    if (Array.isArray(res?.result) && res.result.length > 0) {
                        mileageVal = res.result[0].mileage;
                    } else if (res?.result && !Array.isArray(res.result) && res.result.mileage !== undefined) {
                        mileageVal = res.result.mileage;
                    } else if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
                        mileageVal = res.data[0].mileage;
                    }
                    return Number(mileageVal || 0) / 1000;
                };

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const parseHpCount = (res: any) => {
                    if (Array.isArray(res?.result)) return res.result.length;
                    if (res?.result && Array.isArray(res.result.list)) return res.result.list.length;
                    return 0;
                };

                const mLocal = parseMileage(rLocal);
                const mUtc = parseMileage(rUtc);
                const mBj = parseMileage(rBj);
                const mRawUtc = parseMileage(rRawUtc);
                const mCurLocal = parseMileage(rCurLocal);
                const mCurUtc = parseMileage(rCurUtc);
                const mY = parseMileage(rY);
                const mM30 = parseMileage(rM30);
                const hpCount = parseHpCount(rHP);

                // Calculate integrated distance from track history (HP)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rHPany = rHP as any;
                const pts = Array.isArray(rHPany?.result)
                    ? rHPany.result
                    : (rHPany?.result?.list || (Array.isArray(rHPany?.data) ? rHPany.data : (rHPany?.data?.list || [])));
                
                let integratedDistanceKm = 0;
                if (pts.length > 0) {
                    let distMeters = 0;
                    let prevPoint: { lat: number; lng: number } | null = null;
                    for (const pt of pts) {
                        if (!pt || pt.lat === undefined || pt.lng === undefined) continue;
                        const lat = Number(pt.lat);
                        const lng = Number(pt.lng);
                        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;
                        if (prevPoint) {
                            distMeters += haversineDistance(prevPoint.lat, prevPoint.lng, lat, lng);
                        }
                        prevPoint = { lat, lng };
                    }
                    integratedDistanceKm = distMeters / 1000;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const getStatus = (res: any, val: number) => {
                    if (res?.error) return `Err:${res.error}`;
                    if (res?.code !== undefined && res.code !== 0) return `C:${res.code}`;
                    return `${val.toFixed(2)}km`;
                };

                const debugStr = `L:${getStatus(rLocal, mLocal)} | U:${getStatus(rUtc, mUtc)} | B:${getStatus(rBj, mBj)} | RU:${getStatus(rRawUtc, mRawUtc)} | CL:${getStatus(rCurLocal, mCurLocal)} | CU:${getStatus(rCurUtc, mCurUtc)} | Y:${getStatus(rY, mY)} | M30:${getStatus(rM30, mM30)} | HP:${hpCount}pts | Calc:${integratedDistanceKm.toFixed(2)}km`;
                
                console.log('[DEBUG Today Mileage] All responses:', {
                    local: rLocal, utc: rUtc, bj: rBj, rawUtc: rRawUtc, curLocal: rCurLocal, curUtc: rCurUtc, yesterday: rY, m30: rM30, hp: rHP
                }, debugStr);

                // Fall back to integrated distance if all API mileage ranges returned 0
                const bestMileage = mLocal || mUtc || mBj || mRawUtc || mCurLocal || mCurUtc || integratedDistanceKm || 0;
                setTodayMileage(bestMileage);
            } catch (err) {
                console.error('[DEBUG Today Mileage] Error caught:', err);
                if (isMounted) {
                    setTodayMileage(0);
                }
            } finally {
                if (isMounted) setMileageLoading(false);
            }
        };

        fetchMileage();

        return () => {
            isMounted = false;
        };
    }, [accessToken, selectedDevice?.imei]);

    // Update "last updated" timestamp whenever devices change
    useEffect(() => {
        if (devices.length > 0) {
            setLastUpdate(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        }
    }, [devices]);

    const onlineCount = devices.filter((d: Device) => d.status === '1' || d.posType === 'GPS').length;
    const offlineCount = devices.length - onlineCount;

    return (
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Map - full screen */}
            <div className={`map-wrapper ${showPanel ? 'panel-open' : 'panel-closed'} ${!isMobile && selectedDevice && selectedDevice.lat ? 'card-open' : 'card-closed'}`} style={{ flex: 1, position: 'relative' }}>
                <LiveMap ref={mapRef} />

                {/* ── DESKTOP: Toggle panel button ─────────────────────── */}
                {!isMobile && (
                    <button
                        onClick={() => setShowPanel(!showPanel)}
                        className="sx-btn-icon"
                        style={{
                            position: 'absolute',
                            top: 16,
                            insetInlineStart: showPanel ? 340 : 16,
                            zIndex: 1000,
                            width: 36,
                            height: 36,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            transition: 'inset-inline-start 0.3s ease',
                        }}
                    >
                        <svg className="rtl-flip" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {showPanel ? (
                                <><polyline points="15 18 9 12 15 6" /></>
                            ) : (
                                <><polyline points="9 18 15 12 9 6" /></>
                            )}
                        </svg>
                    </button>
                )}

                {/* ── DESKTOP: Floating device panel ───────────────────── */}
                {!isMobile && showPanel && (
                    <div
                        className="animate-slide-start"
                        style={{
                            position: 'absolute',
                            top: 16, insetInlineStart: 16, bottom: 52,
                            width: 320, zIndex: 999,
                        }}
                    >
                        <DevicePanel />
                    </div>
                )}

                {/* ── MOBILE: Devices toggle button ────────────────────── */}
                {isMobile && (
                    <button
                        onClick={() => setShowMobilePanel(true)}
                        style={{
                            position: 'absolute',
                            top: 12, insetInlineStart: 12,
                            zIndex: 1000,
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 14px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                            cursor: 'pointer',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 11.5 7.3 11.8a1 1 0 0 0 1.4 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
                        </svg>
                        {t('nav.devices')}
                        <span style={{
                            background: 'var(--accent)', color: '#0a0e1a',
                            borderRadius: '999px', padding: '1px 7px',
                            fontSize: '10px', fontWeight: 700,
                        }}>{devices.length}</span>
                    </button>
                )}

                {/* ── DESKTOP: Device detail card (top-right) ──────────── */}
                {!isMobile && selectedDevice && selectedDevice.lat !== undefined && selectedDevice.lng !== undefined && (
                    <div
                        className="info-card-wrapper"
                        style={{
                            position: 'absolute',
                            top: 16,
                            zIndex: 999,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                        }}
                    >
                        <div
                            className="glass-panel animate-slide-end"
                            style={{ width: 320, padding: '20px' }}
                        >
                            {/* Card Header with Close button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '10px',
                                        background: 'var(--accent-dim)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                                            <circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 11.5 7.3 11.8a1 1 0 0 0 1.4 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{selectedDevice.deviceName}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedDevice.imei}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => useDeviceStore.getState().selectDevice(null)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            {/* Address details */}
                            <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{t('deviceDetails.address')}</div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px', lineHeight: '1.4' }}>
                                    {selectedDevice.locDesc || t('deviceDetails.noAddress')}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{t('deviceDetails.coordinates')}</div>
                                <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                    {selectedDevice.lat.toFixed(6)}, {selectedDevice.lng.toFixed(6)}
                                </div>
                            </div>

                            {/* Device GNSS and Last fix */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                <InfoTile label={t('deviceDetails.gnss')} value={selectedDevice.posType || 'GPS'} />
                                <InfoTile label={t('deviceDetails.lastFix')} value={selectedDevice.gpsTime ? formatGimiTimeOnly(selectedDevice.gpsTime) : '—'} />
                            </div>

                            {/* Today's Activity */}
                            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                                    {t('deviceDetails.todaysActivity')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('deviceDetails.todaysMileage')}</span>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)' }}>
                                            {mileageLoading ? t('common.loading') : (todayMileage !== null ? `${todayMileage.toFixed(2)} km` : '0.00 km')}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('deviceDetails.batteryStrength')}</span>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--online)' }}>
                                            {selectedDevice.batteryPowerVal || selectedDevice.battery || '—'}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Row buttons */}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                <button
                                    onClick={() => {
                                        if (selectedDevice.lat && selectedDevice.lng) {
                                            mapRef.current?.centerOnDevice(selectedDevice.lat, selectedDevice.lng);
                                        }
                                    }}
                                    className="sx-btn sx-btn-ghost sx-btn-sm"
                                    style={{ flex: 1, justifyContent: 'center', fontSize: '11px', padding: '6px 8px' }}
                                >
                                    {t('deviceDetails.live')}
                                </button>
                                <button
                                    onClick={() => navigate(`/history?imei=${selectedDevice.imei}`)}
                                    className="sx-btn sx-btn-primary sx-btn-sm"
                                    style={{ flex: 1, justifyContent: 'center', fontSize: '11px', padding: '6px 8px' }}
                                >
                                    {t('deviceDetails.tracks')}
                                </button>
                                <button
                                    onClick={() => navigate('/share-manage')}
                                    className="sx-btn sx-btn-ghost sx-btn-sm"
                                    style={{ flex: 1, justifyContent: 'center', fontSize: '11px', padding: '6px 8px' }}
                                >
                                    {t('deviceDetails.share')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── DESKTOP: Zoom Controls ──────────── */}
                {!isMobile && (
                    <MapZoomControls
                        mapRef={mapRef as React.RefObject<LiveMapHandle>}
                        style={{ position: 'absolute', bottom: 24, insetInlineEnd: 16, zIndex: 998 }}
                    />
                )}

                {/* ── MOBILE: Device list bottom sheet ─────────────────── */}
                {isMobile && showMobilePanel && (
                    <>
                        <div className="mobile-sheet-overlay" onClick={() => setShowMobilePanel(false)} />
                        <div className="mobile-sheet">
                            <div className="mobile-sheet-handle" />
                            <DevicePanel onDeviceSelect={() => setShowMobilePanel(false)} />
                        </div>
                    </>
                )}

                {/* ── MOBILE: Selected device bottom sheet ─────────────── */}
                {isMobile && selectedDevice && selectedDevice.lat !== undefined && selectedDevice.lng !== undefined && !showMobilePanel && (
                    <div style={{
                        position: 'absolute',
                        left: 0, right: 0,
                        bottom: 0,
                        zIndex: 1000,
                        background: 'var(--bg-secondary)',
                        borderTop: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                        padding: '12px 16px 16px',
                        animation: 'slide-up-sheet 0.28s ease forwards',
                        boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                    }}>
                        {/* Handle */}
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 12px' }} />

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: '10px',
                                    background: 'var(--accent-dim)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                                        <circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 11.5 7.3 11.8a1 1 0 0 0 1.4 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
                                    </svg>
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedDevice.deviceName}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedDevice.imei}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Mobile zoom buttons inline */}
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        onClick={() => mapRef.current?.zoomIn()}
                                        style={{
                                            width: 34, height: 34, borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                            color: 'var(--text-primary)', fontSize: '18px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                        }}
                                    >+</button>
                                    <button
                                        onClick={() => mapRef.current?.zoomOut()}
                                        style={{
                                            width: 34, height: 34, borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                            color: 'var(--text-primary)', fontSize: '18px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                        }}
                                    >−</button>
                                </div>
                                <button
                                    onClick={() => useDeviceStore.getState().selectDevice(null)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                        </div>

                        {/* Address details */}
                        <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{t('deviceDetails.address')}</div>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: '1.4' }}>
                                {selectedDevice.locDesc || t('deviceDetails.noAddress')}
                            </div>
                        </div>

                        {/* Info Tiles Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                            <InfoTile label={t('deviceDetails.gnss')} value={selectedDevice.posType || 'GPS'} />
                            <InfoTile label={t('deviceDetails.lastFix')} value={selectedDevice.gpsTime ? formatGimiTimeOnly(selectedDevice.gpsTime) : '—'} />
                            <InfoTile label={t('deviceDetails.coordinates')} value={`${selectedDevice.lat.toFixed(5)}, ${selectedDevice.lng.toFixed(5)}`} />
                            <InfoTile label={t('deviceDetails.speed')} value={`${selectedDevice.speed || 0} km/h`} />
                        </div>

                        {/* Today's Activity */}
                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                                {t('deviceDetails.todaysActivity')}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('deviceDetails.todaysMileage')}</span>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)' }}>
                                        {mileageLoading ? t('common.loading') : (todayMileage !== null ? `${todayMileage.toFixed(2)} km` : '0.00 km')}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('deviceDetails.batteryStrength')}</span>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--online)' }}>
                                        {selectedDevice.batteryPowerVal || selectedDevice.battery || '—'}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action buttons row */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    if (selectedDevice.lat && selectedDevice.lng) {
                                        mapRef.current?.centerOnDevice(selectedDevice.lat, selectedDevice.lng);
                                    }
                                }}
                                className="sx-btn sx-btn-ghost sx-btn-sm"
                                style={{ flex: 1, justifyContent: 'center', fontSize: '11px', padding: '8px' }}
                            >
                                {t('deviceDetails.live')}
                            </button>
                            <button
                                onClick={() => navigate(`/history?imei=${selectedDevice.imei}`)}
                                className="sx-btn sx-btn-primary sx-btn-sm"
                                style={{ flex: 1, justifyContent: 'center', fontSize: '11px', padding: '8px' }}
                            >
                                {t('deviceDetails.tracks')}
                            </button>
                            <button
                                onClick={() => navigate('/share-manage')}
                                className="sx-btn sx-btn-ghost sx-btn-sm"
                                style={{ flex: 1, justifyContent: 'center', fontSize: '11px', padding: '8px' }}
                            >
                                {t('deviceDetails.share')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div style={{
                height: 'var(--statusbar-height)',
                background: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: '20px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                flexShrink: 0,
            }}>
                <span>{devices.length} {t('nav.devices')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="status-dot status-dot--online" style={{ width: 6, height: 6 }} />
                    {onlineCount} {t('dashboard.activeDevices')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="status-dot status-dot--offline" style={{ width: 6, height: 6 }} />
                    {offlineCount} {t('dashboard.offlineDevices')}
                </span>
                <span style={{ marginInlineStart: 'auto' }} dir="ltr">
                    {loading ? t('common.loading') : `Updated ${lastUpdate}`}
                </span>
            </div>
        </div >
    );
}

function InfoTile({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            padding: '10px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
        }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{value}</div>
        </div>
    );
}
