/**
 * Public share viewer — no authentication required.
 * URL format: /share?imei=X&name=X&exp=TS&tok=TOKEN&sig=HMAC
 *
 * This page:
 *  1. Reads URL params
 *  2. Validates HMAC signature + expiry (client-side)
 *  3. Fetches live device location using the embedded token
 *  4. Shows a Leaflet map with the device position
 *  5. Auto-refreshes every 30 seconds
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { validateShareUrl } from '@/services/share';
import { api } from '@/services/api';
import { formatGimiTime } from '@/utils/time';


function buildViewerMapHtml(
    lat: number, lng: number, deviceName: string,
    speed: number, gpsTime: string, isOnline: boolean
): string {
    const accent = '#0891b2';
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#0a0e1a;}
.leaflet-control-zoom a{background:#111827!important;color:#94a3b8!important;}
.leaflet-popup-content-wrapper{background:#1a2035;color:#f1f5f9;border-radius:12px;border:1px solid rgba(255,255,255,0.1);}
.leaflet-popup-tip{background:#1a2035;}
</style>
</head>
<body>
<div id="map"></div>
<script>
var map=L.map('map',{center:[${lat},${lng}],zoom:15,zoomControl:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:18}).addTo(map);
// Pulse circle
L.circle([${lat},${lng}],{
  radius:80,color:'${accent}',fillColor:'${accent}',fillOpacity:0.12,weight:2
}).addTo(map);
// Device marker
var icon=L.divIcon({
  html:'<div style="width:20px;height:20px;border-radius:50%;background:${accent};border:3px solid white;box-shadow:0 0 0 4px ${accent}44"></div>',
  iconSize:[20,20],iconAnchor:[10,10],className:''
});
L.marker([${lat},${lng}],{icon:icon}).addTo(map)
  .bindPopup('<b>${deviceName.replace(/'/g, "\\'")}</b><br>${isOnline ? '🟢 Online' : '⚫ Offline'}<br>🚀 ${speed} km/h<br>🕐 ${gpsTime}')
  .openPopup();
</script>
</body>
</html>`;
}

export default function ShareViewerPage() {
    const [state, setState] = useState<'loading' | 'invalid' | 'expired' | 'valid'>('loading');
    const [deviceName, setDeviceName] = useState('');
    const [expiresAt, setExpiresAt] = useState(0);
    const [locationData, setLocationData] = useState<{ lat: number; lng: number; speed: number; gpsTime: string; isOnline: boolean } | null>(null);
    const [mapHtml, setMapHtml] = useState('');
    const [lastRefresh, setLastRefresh] = useState<string>('');
    const paramsRef = useRef<{ imei: string; tok: string } | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchLocation = useCallback(async () => {
        if (!paramsRef.current) return;
        const { imei, tok } = paramsRef.current;
        try {
            const res = await api.post('', {
                method: 'jimi.device.location.get',
                access_token: tok,
                imei: imei,
                map_type: 'GOOGLE',
            }) as { result?: { lat?: number; lng?: number; speed?: number; gpsTime?: string; status?: string } };
            const loc = res?.result;
            if (loc?.lat && loc?.lng) {
                const data = {
                    lat: loc.lat, lng: loc.lng,
                    speed: loc.speed ?? 0,
                    gpsTime: formatGimiTime(loc.gpsTime ?? ''),
                    isOnline: loc.status === '1',
                };
                setLocationData(data);
                setLastRefresh(new Date().toLocaleTimeString());
                setMapHtml(buildViewerMapHtml(data.lat, data.lng, deviceName, data.speed, data.gpsTime, data.isOnline));
            }
        } catch { /* silent — link might have expired */ }
    }, [deviceName]);

    // Parse and validate URL on mount
    useEffect(() => {
        const search = Platform.OS === 'web' ? window.location.search : '';
        if (!search) { setState('invalid'); return; }

        const params = validateShareUrl(search);
        if (!params) {
            // Check if expired specifically
            const p = new URLSearchParams(search);
            const exp = Number(p.get('exp'));
            if (exp && Date.now() / 1000 > exp) { setState('expired'); }
            else { setState('invalid'); }
            return;
        }

        paramsRef.current = { imei: params.imei, tok: params.tok };
        setDeviceName(params.name);
        setExpiresAt(params.exp);
        setState('valid');

        // Initial fetch then poll every 30s
        fetchLocation();
        pollRef.current = setInterval(fetchLocation, 30000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally runs once on mount

    const timeLeft = () => {
        const sec = expiresAt - Math.floor(Date.now() / 1000);
        if (sec <= 0) return 'Expired';
        if (sec < 3600) return `${Math.floor(sec / 60)}m remaining`;
        if (sec < 86400) return `${Math.floor(sec / 3600)}h remaining`;
        return `${Math.floor(sec / 86400)}d remaining`;
    };

    // ── Error states
    if (state === 'loading') {
        return (
            <View style={v.center}>
                <ActivityIndicator size="large" color="#0891b2" />
                <Text style={v.hint}>Validating share link...</Text>
            </View>
        );
    }

    if (state === 'expired') {
        return (
            <View style={v.center}>
                <Text style={{ fontSize: 64, marginBottom: 16 }}>⏰</Text>
                <Text style={v.errorTitle}>Link Expired</Text>
                <Text style={v.errorSub}>This share link has expired. Ask the owner to generate a new one.</Text>
            </View>
        );
    }

    if (state === 'invalid') {
        return (
            <View style={v.center}>
                <Text style={{ fontSize: 64, marginBottom: 16 }}>🔒</Text>
                <Text style={v.errorTitle}>Invalid Link</Text>
                <Text style={v.errorSub}>This link is invalid or has been tampered with.</Text>
            </View>
        );
    }

    // ── Valid state
    return (
        <View style={v.container}>
            {/* Header bar */}
            <View style={v.header}>
                <View>
                    <Text style={v.headerTitle}>📍 {deviceName}</Text>
                    <Text style={v.headerSub}>Live Location · {timeLeft()}</Text>
                </View>
                <TouchableOpacity style={v.refreshBtn} onPress={fetchLocation}>
                    <Text style={v.refreshBtnText}>⟳</Text>
                </TouchableOpacity>
            </View>

            {/* Map */}
            <View style={v.mapArea}>
                {!locationData ? (
                    <View style={v.center}>
                        <ActivityIndicator size="large" color="#0891b2" />
                        <Text style={[v.hint, { marginTop: 12 }]}>Fetching location...</Text>
                    </View>
                ) : Platform.OS === 'web' && mapHtml ? (
                    <div style={{ width: '100%', height: '100%' }}>
                        <iframe srcDoc={mapHtml} style={{ width: '100%', height: '100%', border: 'none' }} />
                    </div>
                ) : (
                    <View style={v.center}>
                        <Text style={{ color: '#0891b2', fontSize: 16, fontWeight: '700' }}>
                            📍 {locationData.lat.toFixed(5)}, {locationData.lng.toFixed(5)}
                        </Text>
                    </View>
                )}
            </View>

            {/* Stats bar */}
            <View style={v.statsBar}>
                <View style={v.statItem}>
                    <Text style={v.statLabel}>STATUS</Text>
                    <Text style={[v.statValue, { color: locationData?.isOnline ? '#0891b2' : '#6b7280' }]}>
                        {locationData?.isOnline ? '🟢 Online' : '⚫ Offline'}
                    </Text>
                </View>
                <View style={v.statDivider} />
                <View style={v.statItem}>
                    <Text style={v.statLabel}>SPEED</Text>
                    <Text style={v.statValue}>{locationData?.speed ?? 0} km/h</Text>
                </View>
                <View style={v.statDivider} />
                <View style={v.statItem}>
                    <Text style={v.statLabel}>UPDATED</Text>
                    <Text style={v.statValue}>{lastRefresh || '—'}</Text>
                </View>
            </View>

            <Text style={v.footerNote}>
                🔒 Secured by HMAC-SHA256 · Auto-refreshes every 30s · {timeLeft()}
            </Text>
        </View>
    );
}

const v = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0e1a' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0e1a', padding: 24 },
    hint: { color: '#94a3b8', marginTop: 12, fontSize: 14 },
    errorTitle: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', marginBottom: 8 },
    errorSub: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22, maxWidth: 300 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#f1f5f9' },
    headerSub: { fontSize: 12, color: '#0891b2', marginTop: 2 },
    refreshBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(0,212,170,0.12)', alignItems: 'center', justifyContent: 'center',
    },
    refreshBtnText: { fontSize: 20, color: '#0891b2' },

    mapArea: { flex: 1 },

    statsBar: {
        flexDirection: 'row', backgroundColor: '#111827',
        borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        paddingVertical: 12,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statLabel: { fontSize: 9, fontWeight: '700', color: '#475569', letterSpacing: 1, marginBottom: 4 },
    statValue: { fontSize: 13, fontWeight: '700', color: '#f1f5f9' },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

    footerNote: {
        fontSize: 10, color: '#475569', textAlign: 'center',
        paddingVertical: 8, backgroundColor: '#0a0e1a',
    },
});
