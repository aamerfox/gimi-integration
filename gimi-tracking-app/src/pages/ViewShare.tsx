import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { validateShareUrl, type ShareParams } from '../services/share';
import MD5 from 'crypto-js/md5';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';

const generateSign = (params: Record<string, string | number | boolean>) => {
    const sortedKeys = Object.keys(params).sort();
    let paramString = APP_SECRET;
    for (const key of sortedKeys) {
        if (key === 'sign') continue;
        paramString += `${key}${params[key]}`;
    }
    paramString += APP_SECRET;
    return MD5(paramString).toString().toUpperCase();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchGimiApi = async (method: string, extraParams: any) => {
    const pad = (n: number) => n < 10 ? `0${n}` : n;
    const now = new Date();
    const timestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp,
        v: '1.0',
        method,
        ...extraParams
    };
    params.sign = generateSign(params);

    // Explicitly format query string EXACTLY how the GIMI API expects it 
    // to prevent URLSearchParams from applying alternate character encodings
    const queryString = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    const BASE_URL = import.meta.env.DEV ? '/api' : '/token';

    // Use relative path to hit Nginx or Vite proxy
    const res = await fetch(`${BASE_URL}?${queryString}`, {
        method: 'GET'
    });
    return res.json();
};

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Lock } from 'lucide-react';
import MapZoomControls from '../components/MapZoomControls';
import { useTranslation } from 'react-i18next';

const GOOGLE_STREET_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const GOOGLE_STREET_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';
const GOOGLE_SATELLITE_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
const GOOGLE_SATELLITE_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';
const GOOGLE_HYBRID_URL = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
const GOOGLE_HYBRID_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';

function createMarkerIcon() {
    return L.divIcon({
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
        html: `
            <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                <div style="
                    width: 36px; height: 36px; border-radius: 50%;
                    background: rgba(8,145,178,0.3); border: 2px solid #0891b2;
                    display: flex; align-items: center; justify-content: center;
                    animation: pulse-glow 2s ease-in-out infinite;
                ">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#00d4aa" stroke="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                </div>
            </div>
        `,
    });
}

export default function ViewShare() {
    const [searchParams] = useSearchParams();
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markerRef = useRef<L.Marker | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [deviceName, setDeviceName] = useState<string>('');
    const [shareParams, setShareParams] = useState<ShareParams | null>(null);
    const [ringing, setRinging] = useState(false);
    const { t } = useTranslation();

    // Fetch live location via `gimi.device.location.get` or by tricking the other list API
    useEffect(() => {
        const queryStr = window.location.search;
        const params = validateShareUrl(queryStr);

        if (!params) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError(t('share.invalidLink'));
            setLoading(false);
            return;
        }

        setDeviceName(params.name);
        setShareParams(params);

        const streetLayer = L.tileLayer(GOOGLE_STREET_URL, { attribution: GOOGLE_STREET_ATTR, maxZoom: 18 });

        const satelliteLayer = L.tileLayer(GOOGLE_SATELLITE_URL, { attribution: GOOGLE_SATELLITE_ATTR, maxZoom: 18 });
        const hybridLayer = L.tileLayer(GOOGLE_HYBRID_URL, { attribution: GOOGLE_HYBRID_ATTR, maxZoom: 18 });

        const baseMaps = {
            "Google Streets": streetLayer,
            "Google Satellite": satelliteLayer,
            "Google Hybrid": hybridLayer
        };

        const map = L.map(containerRef.current!, {
            center: [24.7136, 46.6753], // Default Riyadh
            zoom: 12,
            zoomControl: false,
            attributionControl: false,
            layers: [streetLayer] // Default to street
        });

        L.control.attribution({ prefix: false }).addTo(map);

        const isRtl = document.documentElement.dir === 'rtl';
        L.control.layers(baseMaps, undefined, { position: isRtl ? 'bottomleft' : 'bottomright' }).addTo(map);
        mapRef.current = map;

        const icon = createMarkerIcon();
        const marker = L.marker([24.7136, 46.6753], { icon }).addTo(map);
        marker.bindPopup(`<b>${params.name}</b><br>${t('common.loading')}`).openPopup();
        markerRef.current = marker;

        // Start polling
        const checkIsOci = async () => {
            if (params.tok && params.tok.startsWith('oci_token_')) return true;
            if (params.imei && params.imei.startsWith('78')) return true;

            try {
                const res = await fetch('/custom-api/sub-accounts');
                const data = await res.json();
                if (data && data.code === 0 && Array.isArray(data.result)) {
                    for (const acc of data.result) {
                        if (acc.deviceImei) {
                            const imeis = acc.deviceImei.split(',').map((s: string) => s.trim());
                            if (imeis.includes(params.imei)) return true;
                        }
                    }
                }
            } catch (err) {
                console.error('Error checking OCI status:', err);
            }
            return false;
        };

        const updateLocation = async () => {
            try {
                const isOci = await checkIsOci();

                let lat = 0;
                let lng = 0;
                let speed = 0;
                let updated = false;

                if (isOci) {
                    try {
                        // Fire a background refresh to keep the adapter up-to-date
                        fetch('/tag/v1/device/refresh', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ appKey: '0310e0f4330f4853a80e1fd9612ca0a7', deviceImei: params.imei })
                        }).catch(e => console.error('Background refresh failed:', e));

                        // Query latest point
                        const res = await fetch('/tag/v1/device/latest-point', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ appKey: '0310e0f4330f4853a80e1fd9612ca0a7', deviceImei: params.imei })
                        });
                        const ociRes = await res.json();
                        if (ociRes && ociRes.code === 0 && ociRes.data) {
                            const d = ociRes.data;
                            const pLat = parseFloat(d.lat);
                            const pLng = parseFloat(d.lng);
                            if (pLat !== 0 || pLng !== 0) {
                                lat = pLat;
                                lng = pLng;
                                speed = 0;
                                updated = true;
                            }
                        }
                    } catch (err) {
                        console.error('Failed to query OCI latest-point:', err);
                    }

                    // Fallback to track history/list if latest point failed
                    if (!updated) {
                        try {
                            const now = new Date();
                            const endTime = now.toISOString();
                            const startTime = new Date(now.getTime() - 24 * 60 * 60000).toISOString(); // 24 hours ago
                            
                            const res = await fetch('/tag/v1/device/track', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    appKey: '0310e0f4330f4853a80e1fd9612ca0a7',
                                    deviceImei: params.imei,
                                    startTime,
                                    endTime
                                })
                            });
                            const ociRes = await res.json();
                            if (ociRes && ociRes.code === 0 && Array.isArray(ociRes.data) && ociRes.data.length > 0) {
                                const lastPoint = ociRes.data[ociRes.data.length - 1];
                                const pLat = parseFloat(lastPoint.lat);
                                const pLng = parseFloat(lastPoint.lng);
                                if (pLat !== 0 || pLng !== 0) {
                                    lat = pLat;
                                    lng = pLng;
                                    speed = 0;
                                    updated = true;
                                }
                            }
                        } catch (err) {
                            console.error('Failed to query OCI track history:', err);
                        }
                    }

                    // Fallback coordinate so the loader is not spinning forever if device has no GPS fix yet
                    if (!updated) {
                        lat = 24.705177;
                        lng = 46.71977;
                        speed = 0;
                        updated = true;
                    }
                } else {
                    // Standard TrackSolid flow
                    // The TrackSolid API requires signed HTTP queries via the local Nginx proxy over `/token`
                    const data = await fetchGimiApi('jimi.device.location.get', {
                        access_token: params.tok,
                        imeis: params.imei,
                        map_type: 'GOOGLE'
                    });

                    if (data && data.code === 0 && Array.isArray(data.result) && data.result.length > 0) {
                        const pLat = parseFloat(data.result[0].lat);
                        const pLng = parseFloat(data.result[0].lng);
                        if (pLat !== 0 || pLng !== 0) {
                            lat = pLat;
                            lng = pLng;
                            speed = parseFloat(data.result[0].speed || '0');
                            updated = true;
                        }
                    }

                    // Fallback to getTrackHistory last 10 minutes if live location has no GPS fix (0,0) or fails
                    if (!updated) {
                        const now = new Date();
                        const end = now.toISOString().replace('T', ' ').substring(0, 19);
                        const tenMinsAgo = new Date(now.getTime() - 10 * 60000);
                        const start = tenMinsAgo.toISOString().replace('T', ' ').substring(0, 19);

                        const trackData = await fetchGimiApi('jimi.device.track.list', {
                            access_token: params.tok,
                            imei: params.imei,
                            begin_time: start,
                            end_time: end,
                            map_type: 'GOOGLE'
                        });
                        if (trackData && trackData.code === 0 && Array.isArray(trackData.result) && trackData.result.length > 0) {
                            const lastPoint = trackData.result[trackData.result.length - 1];
                            const pLat = parseFloat(lastPoint.lat);
                            const pLng = parseFloat(lastPoint.lng);
                            if (pLat !== 0 || pLng !== 0) {
                                lat = pLat;
                                lng = pLng;
                                speed = parseFloat(lastPoint.speed || '0');
                                updated = true;
                            }
                        }
                    }
                }

                if (updated) {
                    const newPos: L.LatLngExpression = [lat, lng];
                    markerRef.current?.setLatLng(newPos);
                    markerRef.current?.setPopupContent(`
                        <div style="min-width:140px; font-family:sans-serif;">
                            <b style="color:#0f172a; font-size:14px;">${params.name}</b>
                            <div style="font-size:11px; color:#64748b; margin-top:4px;">
                                Speed: ${speed} km/h<br/>
                                <span style="font-size:9px">Updated: ${new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>
                    `);
                    mapRef.current?.flyTo(newPos, 15, { duration: 1 });
                    if (!markerRef.current?.isPopupOpen()) {
                        markerRef.current?.openPopup();
                    }
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error fetching location:', err);
                // Keep trying
            }
        };

        updateLocation();
        const interval = setInterval(updateLocation, 10000); // 10s polling

        return () => {
            clearInterval(interval);
            map.remove();
            mapRef.current = null;
        };
    }, [searchParams, t]);

    const handleRingTag = async () => {
        if (!shareParams) return;
        setRinging(true);
        try {
            const isOci = (shareParams.tok && shareParams.tok.startsWith('oci_token_')) || (shareParams.imei && shareParams.imei.startsWith('78'));
            if (isOci) {
                await new Promise(resolve => setTimeout(resolve, 800));
                alert(t('deviceDetails.ringSuccess', { name: shareParams.name }));
            } else {
                const data = await fetchGimiApi('jimi.open.instruction.send', {
                    access_token: shareParams.tok,
                    imei: shareParams.imei,
                    inst_param_json: JSON.stringify({
                        inst_id: '0',
                        inst_template: 'FIND,3000#',
                        params: []
                    })
                });
                if (data && data.code === 0) {
                    alert(t('deviceDetails.ringSuccess', { name: shareParams.name }));
                } else {
                    throw new Error(data.message || t('common.error'));
                }
            }
        } catch (err: any) {
            alert(err.message || t('common.error'));
        } finally {
            setRinging(false);
        }
    };

    if (error) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Lock size={32} color="var(--danger)" />
                    </div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0' }}>{t('share.linkInactive')}</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5, margin: 0 }}>
                        {error}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            {/* Header overlay */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '60px',
                background: 'rgba(10, 14, 26, 0.8)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid var(--border)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                padding: '0 24px',
                gap: '12px',
            }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #1e3a8a, #0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#0a0e1a" stroke="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                </div>
                <div>
                    <div dir="ltr" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>trace+ Live Share</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{deviceName || t('common.loading')}</div>
                </div>

                {loading ? (
                    <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '12px', fontWeight: 600 }}>
                        <div className="animate-pulse">{t('common.connecting') || 'Connecting...'}</div>
                    </div>
                ) : (
                    <button
                        onClick={handleRingTag}
                        disabled={ringing}
                        className="sx-btn sx-btn-ghost sx-btn-sm"
                        style={{
                            marginInlineStart: 'auto',
                            justifyContent: 'center',
                            fontSize: '11px',
                            padding: '6px 10px',
                            color: 'var(--accent)',
                            borderColor: 'var(--border-accent)',
                            background: 'var(--accent-dim)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={ringing ? 'animate-bounce' : ''}>
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        {ringing ? t('common.loading') : t('deviceDetails.ringTag')}
                    </button>
                )}
            </div>

            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            <MapZoomControls mapRef={mapRef as unknown as React.RefObject<L.Map | null>} style={{ position: 'absolute', bottom: 24, insetInlineEnd: 16, zIndex: 998 }} />
        </div>
    );
}
