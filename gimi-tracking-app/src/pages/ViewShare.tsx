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

const fetchGimiApi = async (method: string, extraParams: any) => {
    const pad = (n: number) => n < 10 ? `0${n}` : n;
    const now = new Date();
    const timestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

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

    // Use relative path to hit Nginx proxy
    const res = await fetch(`/token?${queryString}`, {
        method: 'GET'
    });
    return res.json();
};

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Lock } from 'lucide-react';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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

    // Fetch live location via `gimi.device.location.get` or by tricking the other list API
    useEffect(() => {
        const queryStr = window.location.search;
        const params = validateShareUrl(queryStr);

        if (!params) {
            setError('This link is invalid or has expired.');
            setLoading(false);
            return;
        }

        setDeviceName(params.name);

        const map = L.map(containerRef.current!, {
            center: [24.7136, 46.6753], // Default Riyadh
            zoom: 12,
            zoomControl: true,
        });
        L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);
        mapRef.current = map;

        const icon = createMarkerIcon();
        const marker = L.marker([24.7136, 46.6753], { icon }).addTo(map);
        marker.bindPopup(`<b>${params.name}</b><br>Loading live location...`);
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
                let updated = false;

                if (data && data.code === 0 && Array.isArray(data.result) && data.result.length > 0) {
                    lat = parseFloat(data.result[0].lat);
                    lng = parseFloat(data.result[0].lng);
                    updated = true;
                } else {
                    // Fallback to getTrackHistory last 10 minutes
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
                        lat = parseFloat(lastPoint.lat);
                        lng = parseFloat(lastPoint.lng);
                        updated = true;
                    }
                }

                if (updated) {
                    const newPos: L.LatLngExpression = [lat, lng];
                    markerRef.current?.setLatLng(newPos);
                    markerRef.current?.setPopupContent(`
                        <div style="min-width:140px; font-family:sans-serif;">
                            <b style="color:#0f172a; font-size:14px;">${params.name}</b>
                            <div style="font-size:11px; color:#64748b; margin-top:4px;">
                                ${lat.toFixed(5)}, ${lng.toFixed(5)}
                            </div>
                        </div>
                    `);
                    mapRef.current?.flyTo(newPos, 15, { duration: 1 });
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
                    <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0' }}>Link Inactive</h1>
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
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{deviceName || 'Loading device...'}</div>
                </div>

                {loading && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '12px', fontWeight: 600 }}>
                        <div className="animate-pulse">Connecting...</div>
                    </div>
                )}
            </div>

            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
}
