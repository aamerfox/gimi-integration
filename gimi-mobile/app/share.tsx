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
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity, Alert } from 'react-native';
import { validateShareUrl } from '@/services/share';
import { api } from '@/services/api';
import { formatGimiTime } from '@/utils/time';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@/store/language';


function buildViewerMapHtml(
    lat: number, lng: number, deviceName: string,
    speed: number, gpsTime: string, isOnline: boolean,
    direction: 'ltr' | 'rtl'
): string {
    const accent = '#0891b2';
    const isRtl = direction === 'rtl';
    const labelOnline = isRtl ? 'متصل' : 'Online';
    const labelOffline = isRtl ? 'غير متصل' : 'Offline';
    const labelKmh = isRtl ? 'كم/س' : 'km/h';
    return `<!DOCTYPE html>
<html dir="${direction}">
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#0a0e1a;}
.leaflet-control-zoom a{background:#111827!important;color:#94a3b8!important;}
.leaflet-popup-content-wrapper{background:#1a2035;color:#f1f5f9;border-radius:12px;border:1px solid rgba(255,255,255,0.1); text-align: ${isRtl ? 'right' : 'left'};}
.leaflet-popup-tip{background:#1a2035;}
</style>
</head>
<body>
<div id="map"></div>
<script>
var map=L.map('map',{center:[${lat},${lng}],zoom:15,zoomControl:true,attributionControl:false});
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{attribution:'© Google Maps',maxZoom:18}).addTo(map);
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
  .bindPopup('<b>${deviceName.replace(/'/g, "\\'")}</b><br>${isOnline ? '🟢 ' + labelOnline : '⚫ ' + labelOffline}<br>🚀 ${speed} ${labelKmh}<br>🕐 ${gpsTime}')
  .openPopup();
</script>
</body>
</html>`;
}

export default function ShareViewerPage() {
    const { t } = useTranslation();
    const [state, setState] = useState<'loading' | 'invalid' | 'expired' | 'valid'>('loading');
    const [deviceName, setDeviceName] = useState('');
    const [expiresAt, setExpiresAt] = useState(0);
    const [locationData, setLocationData] = useState<{ lat: number; lng: number; speed: number; gpsTime: string; isOnline: boolean } | null>(null);
    const [mapHtml, setMapHtml] = useState('');
    const [lastRefresh, setLastRefresh] = useState<string>('');
    const paramsRef = useRef<{ imei: string; tok: string } | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [ringing, setRinging] = useState(false);

    const handleRingTag = async () => {
        if (!paramsRef.current) return;
        const { imei, tok } = paramsRef.current;
        setRinging(true);
        try {
            const res = await api.post('', {
                method: 'jimi.open.instruction.send',
                access_token: tok,
                imei: imei,
                inst_param_json: JSON.stringify({
                    inst_id: '0',
                    inst_template: 'FIND,3000#',
                    params: []
                })
            }) as { code?: number; message?: string };
            if (Platform.OS === 'web') {
                alert(`Sent ring command to ${deviceName}`);
            } else {
                Alert.alert('Success', `Sent ring command to ${deviceName}`);
            }
        } catch (err: any) {
            let errorMsg = err?.message || 'Failed to send ring command';
            if (errorMsg.includes('243')) {
                errorMsg = 'This device type does not support remote ring commands.';
            }
            if (Platform.OS === 'web') {
                alert(errorMsg);
            } else {
                Alert.alert('Error', errorMsg);
            }
        } finally {
            setRinging(false);
        }
    };

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
                const { direction } = useLanguageStore.getState();
                setMapHtml(buildViewerMapHtml(data.lat, data.lng, deviceName, data.speed, data.gpsTime, data.isOnline, direction));
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
                <Text style={v.hint}>{t('common.loading')}</Text>
            </View>
        );
    }

    if (state === 'expired') {
        return (
            <View style={v.center}>
                <Text style={{ fontSize: 64, marginBottom: 16 }}>⏰</Text>
                <Text style={v.errorTitle}>{t('share.linkExpired')}</Text>
                <Text style={v.errorSub}>{t('share.linkExpiredDesc')}</Text>
            </View>
        );
    }

    if (state === 'invalid') {
        return (
            <View style={v.center}>
                <Text style={{ fontSize: 64, marginBottom: 16 }}>🔒</Text>
                <Text style={v.errorTitle}>{t('share.linkInvalid')}</Text>
                <Text style={v.errorSub}>{t('share.linkInvalidDesc')}</Text>
            </View>
        );
    }

    // ── Valid state
    return (
        <View style={v.container}>
            {/* Header bar */}
            <View style={v.header}>
                <View style={{ flex: 1 }}>
                    <Text style={v.headerTitle}>📍 {deviceName}</Text>
                    <Text style={v.headerSub}>Live Location · {timeLeft()}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    {locationData && (
                        <TouchableOpacity 
                            style={[
                                v.ringBtn, 
                                ringing && { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.4)' }
                            ]} 
                            onPress={handleRingTag}
                            disabled={ringing}
                        >
                            <Text style={[v.ringBtnText, ringing && { color: '#ef4444' }]}>{ringing ? '🔔...' : '🔔 Ring'}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={v.refreshBtn} onPress={fetchLocation}>
                        <Text style={v.refreshBtnText}>⟳</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Map */}
            <View style={v.mapArea}>
                {!locationData ? (
                    <View style={v.center}>
                        <ActivityIndicator size="large" color="#0891b2" />
                        <Text style={[v.hint, { marginTop: 12 }]}>{t('common.loading')}</Text>
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
                    <Text style={v.statLabel}>{t('common.status')?.toUpperCase()}</Text>
                    <Text style={[v.statValue, { color: locationData?.isOnline ? '#0891b2' : '#6b7280' }]}>
                        {locationData?.isOnline ? `🟢 ${t('dashboard.online')}` : `⚫ ${t('dashboard.offline')}`}
                    </Text>
                </View>
                <View style={v.statDivider} />
                <View style={v.statItem}>
                    <Text style={v.statLabel}>{t('common.speed')?.toUpperCase()}</Text>
                    <Text style={v.statValue}>{locationData?.speed ?? 0} {t('common.kmh')}</Text>
                </View>
                <View style={v.statDivider} />
                <View style={v.statItem}>
                    <Text style={v.statLabel}>{t('common.updated')?.toUpperCase()}</Text>
                    <Text style={v.statValue}>{lastRefresh || '—'}</Text>
                </View>
            </View>

            <Text style={v.footerNote}>
                🔒 {t('share.securedBy')} · {t('share.autoRefreshes')} · {timeLeft()}
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
    ringBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(8,145,178,0.15)',
        borderColor: 'rgba(8,145,178,0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0891b2',
    },

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

