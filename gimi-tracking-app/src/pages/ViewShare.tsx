import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { validateShareUrl } from '../services/share';
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
                    background: rgba(0,212,170,0.3); border: 2px solid #00d4aa;
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
            layers: [streetLayer] // Default to street
        });

        L.control.layers(baseMaps).addTo(map);
        mapRef.current = map;

        const icon = createMarkerIcon();
        const marker = L.marker([24.7136, 46.6753], { icon }).addTo(map);
        marker.bindPopup(`<b>${params.name}</b><br>${t('common.loading')}`).openPopup();
        markerRef.current = marker;

        // Start polling
        const updateLocation = async () => {
            try {
                // The TrackSolid API requires signed HTTP queries via the local Nginx proxy over `/token`
                const data = await fetchGimiApi('jimi.device.location.get', {
                    access_token: params.tok,
                    imeis: params.imei,
                    map_type: 'GOOGLE'
                });

                // If jimi.device.location.get is not permitted, fallback to getTrackList
                let lat = 0;
                let lng = 0;
                let speed = 0;
                let updated = false;

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
    }, [searchParams]);

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
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #00b894)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#0a0e1a" stroke="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                </div>
                <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>SaudiEx Live Share</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{deviceName || t('common.loading')}</div>
                </div>

                {loading && (
                    <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '12px', fontWeight: 600 }}>
                        <div className="animate-pulse">{t('common.connecting') || 'Connecting...'}</div>
                    </div>
                )}
            </div>

            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            <MapZoomControls mapRef={mapRef as React.RefObject<L.Map>} style={{ position: 'absolute', bottom: 24, right: 16, zIndex: 998 }} />
        </div>
    );
}
