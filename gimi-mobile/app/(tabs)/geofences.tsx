import { useState, useCallback, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, ScrollView, Alert, Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { WebView } from 'react-native-webview';
import { useAuthStore } from '@/store/auth';
import { useDeviceStore, Device } from '@/store/devices';
import { useThemeStore } from '@/store/theme';
import { useGeofenceStore, LocalGeofence } from '@/store/geofences';
import { useIsFocused } from '@react-navigation/native';
import { useLanguageStore } from '@/store/language';
import { gimiService } from '@/services/gimi';
import COLORS from '@/constants/Colors';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface ApiGeofence {
    fenceId: string;
    fenceName: string;
    lat: number;
    lng: number;
    radius: number;
    type: string;
    imei?: string;
}

interface RawGeofence {
    fenceId?: string; fenceSerialNo?: string; id?: string;
    fenceName?: string; name?: string;
    lat?: number; centerLat?: number;
    lng?: number; centerLng?: number;
    radius?: number; type?: string; imei?: string;
}

type AlarmType = 'in' | 'out' | 'in,out';
type ViewMode = 'list' | 'create';

function buildGeofenceMapHtml(
    geofences: ApiGeofence[],
    theme: 'dark' | 'light',
    direction: 'ltr' | 'rtl'
): string {
    const bg = theme === 'dark' ? '#0a0e1a' : '#f0f4f8';
    const accent = theme === 'dark' ? '#0891b2' : '#1e3a8a';
    const fencesJson = JSON.stringify(geofences.filter(f => f.lat && f.lng));
    const isRtl = direction === 'rtl';
    const labelRadius = isRtl ? 'نصف القطر:' : 'Radius:';
    const labelImei = isRtl ? 'رقم IMEI:' : 'IMEI:';
    const labelAll = isRtl ? 'الكل' : 'all';

    return `<!DOCTYPE html>
<html dir="${direction}">
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${bg};}
.leaflet-popup-content-wrapper{background:${theme === 'dark' ? '#1a2035' : '#fff'};color:${theme === 'dark' ? '#f1f5f9' : '#0f172a'};border-radius:12px; text-align: ${isRtl ? 'right' : 'left'};}
.leaflet-popup-tip{background:${theme === 'dark' ? '#1a2035' : '#fff'};}
.leaflet-control-zoom a{background:${theme === 'dark' ? '#111827' : '#fff'} !important;color:${theme === 'dark' ? '#94a3b8' : '#475569'} !important;}
</style>
</head>
<body>
<div id="map"></div>
<script>
var fences=${fencesJson};
var accent='${accent}';
var map=L.map('map',{center:[24.7136,46.6753],zoom:6,zoomControl:true,attributionControl:false});
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{attribution:'© Google Maps',maxZoom:18}).addTo(map);

fences.forEach(function(f){
  if(!f.lat||!f.lng) return;
  var r=f.radius||500;
  L.circle([f.lat,f.lng],{
    radius:r, color:accent, fillColor:accent, fillOpacity:0.12, weight:2
  }).addTo(map).bindPopup('<b>'+f.fenceName+'</b><br/>' + labelRadius + ' ' + r + 'm<br/>' + labelImei + ' ' + (f.imei || '(' + labelAll + ')'));
  L.circleMarker([f.lat,f.lng],{
    radius:5,fillColor:accent,fillOpacity:1,color:'#fff',weight:2
  }).addTo(map);
});

if(fences.length>0){
  var group=L.featureGroup(
    fences.map(function(f){return L.circleMarker([f.lat,f.lng]);})
  );
  map.fitBounds(group.getBounds().pad(0.2));
}

// Click to place new fence
map.on('click',function(e){
  try{
    var msg=JSON.stringify({type:'mapClick',lat:e.latlng.lat,lng:e.latlng.lng});
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(msg);
    window.parent&&window.parent.postMessage({type:'mapClick',lat:e.latlng.lat,lng:e.latlng.lng},'*');
  }catch(err){}
});
</script>
</body>
</html>`;
}

export default function GeofencesScreen() {
    const isFocused = useIsFocused();
    const { accessToken, userId } = useAuthStore();
    const { devices } = useDeviceStore();
    const { theme } = useThemeStore();
    const { direction } = useLanguageStore();
    const { t } = useTranslation();
    const { 
        geofences: localFences, 
        apiGeofences, 
        isLoadingApi: loading, 
        apiError: error,
        fetchApiGeofences: fetchGeofences,
        addGeofence, 
        removeGeofence 
    } = useGeofenceStore();
    
    const safeDevices = Array.isArray(devices) ? devices : [];
    const C = COLORS[theme || 'dark'] || COLORS.dark;

    // Fetch API geofences on mount or when devices load
    const fetchedRef = useRef(false);
    useEffect(() => {
        if (!fetchedRef.current || (safeDevices.length > 0 && !fetchedRef.current)) {
            fetchGeofences();
            if (safeDevices.length > 0) {
                fetchedRef.current = true;
            }
        }
    }, [fetchGeofences, safeDevices.length]);

    const [creating, setCreating] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // Create form state
    const [newName, setNewName] = useState('');
    const [newImei, setNewImei] = useState('');
    const [newRadius, setNewRadius] = useState('500');
    const [newAlarmType, setNewAlarmType] = useState<AlarmType>('in,out');
    const [newLat, setNewLat] = useState<number | null>(null);
    const [newLng, setNewLng] = useState<number | null>(null);

    // Combined list
    const allowedImeis = safeDevices.map(d => d.imei).filter(Boolean);
    const safeLocalFences = (Array.isArray(localFences) ? localFences : [])
        .filter(g => !g.imei || allowedImeis.includes(g.imei));
    const safeApiGeofences = Array.isArray(apiGeofences) ? apiGeofences : [];
    const allGeofences: ApiGeofence[] = [

        ...safeApiGeofences.map((g: LocalGeofence) => ({
            fenceId: g.id, 
            fenceName: g.fenceName,
            lat: g.lat, 
            lng: g.lng, 
            radius: g.radius,
            type: 'circle', 
            imei: g.imei,
        })),
        ...safeLocalFences.map((g: LocalGeofence) => ({
            fenceId: g.id, 
            fenceName: g.fenceName,
            lat: g.lat, 
            lng: g.lng, 
            radius: g.radius,
            type: 'circle', 
            imei: g.imei,
        })),
    ];

    const mapHtml = buildGeofenceMapHtml(allGeofences, theme || 'dark', direction);

    // Listen for map click (web iframe)
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'mapClick') {
                setNewLat(e.data.lat);
                setNewLng(e.data.lng);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const handleCreate = async () => {
        if (!newName.trim() || newLat === null || newLng === null) {
            Alert.alert('Missing info', 'Enter a name and tap the map to set location');
            return;
        }
        setCreating(true);

        if (!newImei) {
            // No IMEI: Local only
            addGeofence({
                id: `local-${Date.now()}`,
                fenceName: newName,
                lat: newLat!,
                lng: newLng!,
                radius: parseInt(newRadius) || 500,
                alarmType: newAlarmType,
                imei: undefined,
                deviceName: undefined,
                createdAt: new Date().toISOString(),
                source: 'local',
            });
            Alert.alert('Success', `Geofence "${newName.trim()}" created locally for all devices ✓`);
            setNewName(''); setNewImei(''); setNewRadius('500');
            setNewLat(null); setNewLng(null);
            setViewMode('list');
            setCreating(false);
            return;
        }

        // Has IMEI: Save to TrackSolid API!
        try {
            await gimiService.createDeviceFence(
                accessToken!,
                newImei,
                newName,
                newLat!,
                newLng!,
                parseInt(newRadius) || 500,
                newAlarmType,
            );
            Alert.alert('Success', `Geofence "${newName.trim()}" created on TrackSolid ✓`);
            await fetchGeofences();
            setNewName(''); setNewImei(''); setNewRadius('500');
            setNewLat(null); setNewLng(null);
            setViewMode('list');
        } catch (err: any) {
            // Fallback: save locally and notify user
            addGeofence({
                id: `local-${Date.now()}`,
                fenceName: newName,
                lat: newLat!,
                lng: newLng!,
                radius: parseInt(newRadius) || 500,
                alarmType: newAlarmType,
                imei: newImei,
                deviceName: safeDevices.find((d: Device) => d.imei === newImei)?.deviceName,
                createdAt: new Date().toISOString(),
                source: 'local',
            });
            Alert.alert(
                'Created Locally (Server Fallback)',
                `Failed to create on TrackSolid server: ${err.message || 'API Error'}. The geofence has been saved locally instead.`
            );
            setNewName(''); setNewImei(''); setNewRadius('500');
            setNewLat(null); setNewLng(null);
            setViewMode('list');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = (fenceId: string, isLocal: boolean) => {
        if (isLocal) {
            removeGeofence(fenceId);
        } else {
            Alert.alert(
                t('geofences.deleteConfirmTitle'),
                t('geofences.deleteConfirmDesc'),
                [
                    { text: t('common.cancel') },
                    {
                        text: t('common.delete'), style: 'destructive',
                        onPress: async () => {
                            try {
                                const fence = safeApiGeofences.find(f => f.id === fenceId);
                                const imei = fence?.imei || '';
                                if (imei) {
                                    await gimiService.deleteDeviceFence(accessToken!, imei, fenceId);
                                }
                                await fetchGeofences();
                            } catch (err: any) {
                                Alert.alert(t('geofences.deleteFailed'), err.message || 'API error');
                            }
                        },
                    },
                ]
            );
        }
    };

    const s = styles(C);

    return (
        <View style={s.container}>
            {/* ── Tab bar */}
            <View style={s.tabBar}>
                <TouchableOpacity
                    style={[s.tabBtn, viewMode === 'list' && s.tabBtnActive]}
                    onPress={() => setViewMode('list')}
                >
                    <Text style={[s.tabBtnText, viewMode === 'list' && { color: C.accent }]}><Feather name="list" size={13} color={viewMode === 'list' ? C.accent : '#94a3b8'} /> {t('geofences.fences')} ({allGeofences.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.tabBtn, viewMode === 'create' && s.tabBtnActive]}
                    onPress={() => setViewMode('create')}
                >
                    <Text style={[s.tabBtnText, viewMode === 'create' && { color: C.accent }]}><Feather name="plus-circle" size={13} color={viewMode === 'create' ? C.accent : '#94a3b8'} /> {t('geofences.create')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.refreshBtn} onPress={fetchGeofences}>
                    <Text style={[s.tabBtnText, { color: C.accent }]}><Feather name="refresh-cw" size={13} color={C.accent} /></Text>
                </TouchableOpacity>
            </View>

            {error && <Text style={s.errorText}>{error}</Text>}

            {/* ── Map */}
            <View style={s.mapWrap}>
                {Platform.OS === 'web' ? (
                    <div style={{ width: '100%', height: '100%' }}>
                        <iframe srcDoc={mapHtml} style={{ width: '100%', height: '100%', border: 'none' }} />
                    </div>
                ) : isFocused ? (
                    <View style={{ flex: 1 }}>
                        <WebView
                            key={`geofences-map-${theme || 'dark'}`}
                            originWhitelist={['*']}
                            source={{ html: mapHtml }}
                            style={{ flex: 1 }}
                            containerStyle={{ width: '100%', height: '100%' }}
                            onMessage={(event) => {
                                try {
                                    const msg = JSON.parse(event.nativeEvent.data);
                                    if (msg.type === 'mapClick') {
                                        setNewLat(msg.lat);
                                        setNewLng(msg.lng);
                                    }
                                } catch (err) { }
                            }}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                        />
                    </View>
                ) : (
                    <View style={{ flex: 1, backgroundColor: C.bgPrimary }} />
                )}
            </View>

            {/* ── List panel */}
            {viewMode === 'list' && (
                <View style={s.panel}>
                    {loading && <ActivityIndicator color={C.accent} style={{ marginVertical: 8 }} />}
                    <FlatList
                        data={allGeofences}
                        keyExtractor={f => f.fenceId}
                        style={s.list}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={
                            <Text style={[s.emptyText, { color: C.textMuted }]}>
                                {loading ? t('common.loading') : t('geofences.noGeofences')}
                            </Text>
                        }
                        renderItem={({ item }) => {
                            const isLocal = safeLocalFences.some(l => l.id === item.fenceId);
                            return (
                                <View style={s.fenceItem}>
                                    <View style={[s.fenceIcon, { backgroundColor: `${C.accent}20` }]}>
                                        <Feather name="map-pin" size={18} color={C.accent} />
                                    </View>
                                    <View style={s.fenceInfo}>
                                        <Text style={s.fenceName}>{item.fenceName}</Text>
                                        <Text style={s.fenceMeta}>
                                            r={item.radius}m
                                            {item.imei ? ` · ${item.imei}` : ` · ${t('geofences.allDevices')}`}
                                            {isLocal ? ' · 💾 Local' : ''}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={s.deleteBtn}
                                        onPress={() => handleDelete(item.fenceId, isLocal)}
                                    >
                                        <Text style={s.deleteBtnText}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        }}
                    />
                </View>
            )}

            {/* ── Create form */}
            {viewMode === 'create' && (
                <View style={s.panel}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        <Text style={s.formLabel}>{t('geofences.fenceNameLabel')}</Text>
                        <TextInput style={s.input} value={newName} onChangeText={setNewName}
                            placeholder={t('geofences.placeholderName')} placeholderTextColor={C.textMuted} />

                        <Text style={s.formLabel}>{t('geofences.deviceLabel')}</Text>
                        <View style={s.pickerWrap}>
                            <Picker selectedValue={newImei} onValueChange={setNewImei}
                                style={s.picker} dropdownIconColor={C.textMuted}>
                                <Picker.Item label={t('geofences.allDevices')} value="" color={C.textMuted} />
                                {safeDevices.map((d: Device) => (
                                    <Picker.Item key={d.imei} label={d.deviceName} value={d.imei} color={C.textPrimary} />
                                ))}
                            </Picker>
                        </View>

                        <Text style={s.formLabel}>{t('geofences.radiusLabel')}</Text>
                        <TextInput style={s.input} value={newRadius} onChangeText={setNewRadius}
                            keyboardType="numeric" placeholder="500" placeholderTextColor={C.textMuted} />

                        <Text style={s.formLabel}>{t('geofences.alarmTypeLabel')}</Text>
                        <View style={s.alarmRow}>
                            {(['in', 'out', 'in,out'] as AlarmType[]).map(t => (
                                <TouchableOpacity
                                    key={t}
                                    style={[s.alarmBtn, newAlarmType === t && s.alarmBtnActive]}
                                    onPress={() => setNewAlarmType(t)}
                                >
                                    <Text style={[s.alarmBtnText, newAlarmType === t && { color: C.accent }]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={s.locationRow}>
                            <View style={[s.locationStatus, { backgroundColor: newLat ? `${C.online}20` : `${C.warning}20` }]}>
                                <Text style={{ color: newLat ? C.online : C.warning, fontSize: 12 }}>
                                    {newLat ? <><Feather name="map-pin" size={12} color={C.online} /> {newLat.toFixed(4)}, {newLng!.toFixed(4)}</> : <><Feather name="map" size={12} color={C.warning} /> {t('geofences.tapMapHint')}</>}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[s.createBtn, (creating || !newName.trim() || newLat === null) && s.createBtnDisabled]}
                            onPress={handleCreate}
                            disabled={creating || !newName.trim() || newLat === null}
                        >
                            {creating
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={s.createBtnText}><Feather name="check" size={14} color="#fff" /> {t('geofences.createGeofenceBtn')}</Text>
                            }
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgPrimary },
    tabBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.bgSecondary, borderBottomWidth: 1, borderColor: C.border,
    },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabBtnActive: { borderBottomWidth: 2, borderBottomColor: C.accent },
    tabBtnText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
    refreshBtn: { paddingHorizontal: 16, paddingVertical: 12 },
    errorText: { color: '#ef4444', fontSize: 12, textAlign: 'center', padding: 8 },

    mapWrap: { flex: 1, minHeight: 200, maxHeight: 300 },
    mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    mapEmptyIcon: { fontSize: 40, marginBottom: 8 },
    mapEmptyText: { fontSize: 13, textAlign: 'center' },

    panel: {
        flex: 1, backgroundColor: C.bgSecondary,
        borderTopWidth: 1, borderColor: C.border,
        paddingHorizontal: 0, paddingVertical: 4,
    },
    list: { flex: 1 },
    emptyText: { textAlign: 'center', marginTop: 20, fontSize: 13 },

    fenceItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 10,
        borderBottomWidth: 1, borderColor: C.border, gap: 10,
    },
    fenceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    fenceInfo: { flex: 1 },
    fenceName: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
    fenceMeta: { fontSize: 11, color: C.textMuted, marginTop: 2 },
    deleteBtn: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center',
    },
    deleteBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },

    formLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 1, marginBottom: 4, marginTop: 10 },
    input: {
        backgroundColor: C.bgElevated, borderRadius: 10, borderWidth: 1, borderColor: C.border,
        paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.textPrimary,
    },
    pickerWrap: {
        backgroundColor: C.bgElevated, borderRadius: 10,
        borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 2,
        height: 52, justifyContent: 'center',
    },
    picker: {
        color: C.textPrimary,
        height: Platform.OS === 'android' ? 52 : 44,
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    alarmRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    alarmBtn: {
        flex: 1, paddingVertical: 8, borderRadius: 8,
        backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border, alignItems: 'center',
    },
    alarmBtnActive: { borderColor: C.accent, backgroundColor: `${C.accent}15` },
    alarmBtnText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
    locationRow: { marginVertical: 8 },
    locationStatus: { borderRadius: 8, padding: 10 },
    createBtn: { backgroundColor: C.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12, marginBottom: 16 },
    createBtnDisabled: { opacity: 0.5 },
    createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
