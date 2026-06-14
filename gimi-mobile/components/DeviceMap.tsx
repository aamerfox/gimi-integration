/**
 * Cross-platform map component:
 * - Web: renders an iframe/div with a Leaflet HTML string
 * - Native (iOS/Android): uses WebView with the same HTML
 *
 * Props:
 *   devices: Device[] — all devices with lat/lng
 *   selectedImei: string | null — highlighted device
 *   onMarkerTap: (imei: string) => void
 *   theme: 'dark' | 'light'
 */

import { useEffect, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Device } from '@/store/devices';
import { formatGimiTime } from '@/utils/time';

interface Props {
  devices: Device[];
  selectedImei: string | null;
  onMarkerTap: (imei: string) => void;
  theme: 'dark' | 'light';
  style?: object;
}

// Build the full Leaflet HTML page as a string
function buildMapHtml(devices: Device[], selectedImei: string | null, theme: 'dark' | 'light'): string {
  const bg = theme === 'dark' ? '#0a0e1a' : '#f0f4f8';
  const accentOnline = theme === 'dark' ? '#0891b2' : '#1e3a8a';
  const accentOffline = '#6b7280';

  const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const TILE_ATTR = '© OpenStreetMap';
  const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const SATELLITE_ATTR = 'Tiles &copy; Esri';
  const HYBRID_URL = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
  const HYBRID_ATTR = '&copy; Google Maps';

  const devicesJson = JSON.stringify(
    devices
      .filter((d) => d.lat && d.lng)
      .map((d) => ({
        imei: d.imei,
        name: d.deviceName,
        lat: d.lat,
        lng: d.lng,
        speed: d.speed ?? 0,
        battery: d.batteryPowerVal ?? d.battery ?? '—',
        gpsTime: formatGimiTime(d.sysTime || d.gpsTime),
        status: d.status,
        isOnline: d.status === '1' || d.posType === 'GPS' || !!(d.sysTime && (Date.now() - new Date(d.sysTime.replace(' ', 'T') + 'Z').getTime()) < 5 * 60 * 1000),
        selected: d.imei === selectedImei,
      }))
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${bg};}
  .leaflet-popup-content-wrapper{background:${theme === 'dark' ? '#1a2035' : '#fff'};color:${theme === 'dark' ? '#f1f5f9' : '#0f172a'};border:1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.2);}
  .leaflet-popup-tip{background:${theme === 'dark' ? '#1a2035' : '#fff'};}
  .leaflet-control-zoom a{background:${theme === 'dark' ? '#111827' : '#fff'} !important;color:${theme === 'dark' ? '#94a3b8' : '#475569'} !important;border-color:${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} !important;}
  .device-marker{width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.4);}
  .device-marker.online{background:${accentOnline};}
  .device-marker.offline{background:${accentOffline};}
  .device-marker.selected{width:22px;height:22px;border:3px solid white;box-shadow:0 0 0 4px ${accentOnline}66;}
  .pulse-ring{position:absolute;top:-4px;left:-4px;right:-4px;bottom:-4px;border-radius:50%;animation:pulse 2s ease-out infinite;border:2px solid ${accentOnline};}
  @keyframes pulse{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.2);opacity:0}}
  .popup-name{font-weight:700;font-size:14px;margin-bottom:4px;}
  .popup-row{font-size:12px;color:${theme === 'dark' ? '#94a3b8' : '#475569'};margin:2px 0;}
  .popup-badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;}
  .badge-online{background:rgba(0,212,170,0.15);color:${accentOnline};}
  .badge-offline{background:rgba(107,114,128,0.15);color:#9ca3af;}
</style>
</head>
<body>
<div id="map"></div>
<script>
var devices = ${devicesJson};
var map = L.map('map', {
  center: devices.length ? [devices[0].lat, devices[0].lng] : [26.5, 45.1],
  zoom: devices.length === 1 ? 14 : 5,
  zoomControl: true,
  layers: [L.tileLayer('${HYBRID_URL}', {attribution: '${HYBRID_ATTR}', maxZoom: 18})]
});

var streetLayer = L.tileLayer('${TILE_URL}', {attribution: '${TILE_ATTR}', maxZoom: 18});
var satelliteLayer = L.tileLayer('${SATELLITE_URL}', {attribution: '${SATELLITE_ATTR}', maxZoom: 18});
var hybridLayer = L.tileLayer('${HYBRID_URL}', {attribution: '${HYBRID_ATTR}', maxZoom: 18});

var baseMaps = {
  "Earth View": satelliteLayer,
  "Hybrid (Earth + Streets)": hybridLayer,
  "Street View": streetLayer
};
L.control.layers(baseMaps, undefined, { position: 'topleft' }).addTo(map);

var markers = {};
devices.forEach(function(d){
  var isOnline = d.isOnline;
  var el = document.createElement('div');
  el.style.position = 'relative';
  var dot = document.createElement('div');
  dot.className = 'device-marker ' + (isOnline ? 'online' : 'offline') + (d.selected ? ' selected' : '');
  el.appendChild(dot);
  if(isOnline && d.selected){
    var ring = document.createElement('div');
    ring.className = 'pulse-ring';
    el.appendChild(ring);
  }
  var icon = L.divIcon({html: el.outerHTML, iconSize: d.selected ? [22,22] : [16,16], iconAnchor: d.selected ? [11,11] : [8,8], className: ''});
  var popupHtml = '<div class="popup-name">'+d.name+'</div>'
    + '<span class="popup-badge '+(isOnline?'badge-online':'badge-offline')+'">'+(isOnline?'ONLINE':'OFFLINE')+'</span>'
    + '<div class="popup-row">📡 IMEI: '+d.imei+'</div>'
    + '<div class="popup-row">🚀 Speed: '+d.speed+' km/h</div>'
    + '<div class="popup-row">🔋 Battery: '+d.battery+'</div>'
    + (d.gpsTime ? '<div class="popup-row">🕐 '+d.gpsTime+'</div>' : '');
  var marker = L.marker([d.lat, d.lng], {icon: icon})
    .bindPopup(popupHtml, {maxWidth: 280})
    .addTo(map);
  marker.on('click', function(){
    try{window.ReactNativeWebView.postMessage(d.imei);}catch(e){}
    try{window.parent.postMessage({type:'markerTap',imei:d.imei},'*');}catch(e){}
  });
  markers[d.imei] = marker;
  if(d.selected){ marker.openPopup(); }
});

if(devices.length > 1){
  var group = L.featureGroup(Object.values(markers));
  map.fitBounds(group.getBounds().pad(0.15));
}
</script>
</body>
</html>`;
}

import { WebView } from 'react-native-webview';

// ── Web renderer using iframe (works in Expo web / metro bundler)
// ── Native renderer using WebView (works on Android / iOS)
function MapWeb({ devices, selectedImei, onMarkerTap, theme, style }: Props) {
  const html = buildMapHtml(devices, selectedImei, theme);
  // Keep a stable ref so the listener always has the latest callback
  const onTapRef = useRef(onMarkerTap);
  useEffect(() => { onTapRef.current = onMarkerTap; }, [onMarkerTap]);

  // Handle messages on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'markerTap') onTapRef.current(e.data.imei);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []); // runs once

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        <div style={{ width: '100%', height: '100%' }}>
          <iframe
            srcDoc={html}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      </View>
    );
  }

  // Native (Android/iOS)
  return (
    <View style={[styles.container, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        containerStyle={{ width: '100%', height: '100%' }}
        onMessage={(event) => {
          const message = event.nativeEvent.data;
          // The leafet script sends imei as a plain string inside window.ReactNativeWebView.postMessage(d.imei)
          if (message) {
            onTapRef.current(message);
          }
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default MapWeb;
export { buildMapHtml };
