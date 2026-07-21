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
import { useIsFocused } from '@react-navigation/native';
import { useLanguageStore } from '@/store/language';

interface Props {
  devices: Device[];
  selectedImei: string | null;
  onMarkerTap: (imei: string) => void;
  theme: 'dark' | 'light';
  style?: object;
}

// Build the full Leaflet HTML page as a string
function buildMapHtml(devices: Device[], selectedImei: string | null, theme: 'dark' | 'light', direction: 'ltr' | 'rtl'): string {
  const safeDevices = Array.isArray(devices) ? devices : [];
  const bg = theme === 'dark' ? '#0a0e1a' : '#f0f4f8';
  const accentOnline = theme === 'dark' ? '#0891b2' : '#1e3a8a';
  const accentOffline = '#6b7280';
  const imeiIconColor = theme === 'dark' ? '#0891b2' : '#0284c7';
  const batteryIconColor = theme === 'dark' ? '#10b981' : '#059669';
  const clockIconColor = theme === 'dark' ? '#a78bfa' : '#7c3aed';

  const TILE_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
  const TILE_ATTR = '&copy; Google Maps';
  const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const SATELLITE_ATTR = 'Tiles &copy; Esri';
  const HYBRID_URL = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
  const HYBRID_ATTR = '&copy; Google Maps';

  const isRtl = direction === 'rtl';
  const labelOnline = isRtl ? 'متصل' : 'ONLINE';
  const labelOffline = isRtl ? 'غير متصل' : 'OFFLINE';
  const labelImei = isRtl ? 'رقم IMEI:' : 'IMEI:';
  const labelBattery = isRtl ? 'البطارية:' : 'Battery:';

  const devicesJson = JSON.stringify(
    safeDevices
      .filter((d) => {
        const latVal = typeof d.lat === 'string' ? parseFloat(d.lat) : Number(d.lat);
        const lngVal = typeof d.lng === 'string' ? parseFloat(d.lng) : Number(d.lng);
        return !isNaN(latVal) && !isNaN(lngVal) && latVal !== 0 && lngVal !== 0;
      })
      .map((d) => {
        const latVal = typeof d.lat === 'string' ? parseFloat(d.lat) : Number(d.lat);
        const lngVal = typeof d.lng === 'string' ? parseFloat(d.lng) : Number(d.lng);
        return {
          imei: d.imei,
          name: d.deviceName,
          lat: latVal,
          lng: lngVal,
          battery: d.batteryPowerVal ?? d.battery ?? '—',
          gpsTime: formatGimiTime(d.sysTime || d.gpsTime),
          status: d.status,
          isOnline: d.status === '1' || d.posType === 'GPS' || !!(d.sysTime && (Date.now() - new Date(d.sysTime.replace(' ', 'T') + 'Z').getTime()) < 5 * 60 * 1000),
          selected: d.imei === selectedImei,
        };
      })
  );

  return `<!DOCTYPE html>
<html dir="${direction}">
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${bg};}
  .leaflet-popup-content-wrapper{background:${theme === 'dark' ? '#1a2035' : '#fff'};color:${theme === 'dark' ? '#f1f5f9' : '#0f172a'};border:1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.2); text-align: ${isRtl ? 'right' : 'left'};}
  .leaflet-popup-tip{background:${theme === 'dark' ? '#1a2035' : '#fff'};}
  .leaflet-control-zoom a{background:${theme === 'dark' ? '#111827' : '#fff'} !important;color:${theme === 'dark' ? '#94a3b8' : '#475569'} !important;border-color:${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} !important;}
  .leaflet-bottom.leaflet-left {
    bottom: 120px !important;
    left: 12px !important;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .leaflet-top.leaflet-left {
    top: ${Platform.OS === 'ios' ? 90 : 70}px !important;
    left: 12px !important;
  }
  .leaflet-control {
    margin-left: 0 !important;
    margin-bottom: 0 !important;
  }
  .device-marker{width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.4);}
  .device-marker.online{background:${accentOnline};}
  .device-marker.offline{background:${accentOffline};}
  .device-marker.selected{width:22px;height:22px;border:3px solid white;box-shadow:0 0 0 4px ${accentOnline}66;}
  .pulse-ring{position:absolute;top:-4px;left:-4px;right:-4px;bottom:-4px;border-radius:50%;animation:pulse 2s ease-out infinite;border:2px solid ${accentOnline};}
  @keyframes pulse{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.2);opacity:0}}
  .popup-name{font-weight:700;font-size:14px;margin-bottom:4px;}
  .popup-row{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: ${theme === 'dark' ? '#94a3b8' : '#475569'};
    margin: 6px 0;
  }
  .popup-row svg {
    flex-shrink: 0;
  }
  .popup-badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;}
  .badge-online{background:rgba(0,212,170,0.15);color:${accentOnline};}
  .badge-offline{background:rgba(107,114,128,0.15);color:#9ca3af;}
</style>
</head>
<body>
<div id="map"></div>
<script>
var devices = ${devicesJson};
var streetLayer = L.tileLayer('${TILE_URL}', {attribution: '${TILE_ATTR}', maxZoom: 18});
var satelliteLayer = L.tileLayer('${SATELLITE_URL}', {attribution: '${SATELLITE_ATTR}', maxZoom: 18});
var hybridLayer = L.tileLayer('${HYBRID_URL}', {attribution: '${HYBRID_ATTR}', maxZoom: 18});

var map = L.map('map', {
  center: devices.length ? [devices[0].lat, devices[0].lng] : [26.5, 45.1],
  zoom: devices.length === 1 ? 14 : 5,
  zoomControl: false,
  attributionControl: false,
  layers: [streetLayer]
});

var baseMaps = {
  "Street View": streetLayer,
  "Earth View": satelliteLayer,
  "Hybrid (Earth + Streets)": hybridLayer
};
L.control.layers(baseMaps, undefined, { position: 'topleft' }).addTo(map);
L.control.zoom({ position: 'bottomleft' }).addTo(map);

var markers = {};
for (var i = 0; i < devices.length; i++) {
  (function() {
    var d = devices[i];
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
      + '<span class="popup-badge '+(isOnline?'badge-online':'badge-offline')+'">'+(isOnline ? labelOnline : labelOffline)+'</span>'
      + '<div style="margin-top: 8px;">'
      + '<div class="popup-row">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${imeiIconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/></svg>'
      + '<span>' + labelImei + ' '+d.imei+'</span>'
      + '</div>'
      + '<div class="popup-row">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${batteryIconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><line x1="23" y1="11" x2="23" y2="13"/></svg>'
      + '<span>' + labelBattery + ' '+d.battery+(d.battery !== '—' && d.battery !== 'N/A' && !String(d.battery).includes('%') ? '%' : '')+'</span>'
      + '</div>'
      + (d.gpsTime ? '<div class="popup-row">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${clockIconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
      + '<span>'+d.gpsTime+'</span>'
      + '</div>' : '')
      + '</div>';
    var marker = L.marker([d.lat, d.lng], {icon: icon})
      .bindPopup(popupHtml, {maxWidth: 280})
      .addTo(map);
    marker.on('click', function(){
      try{window.ReactNativeWebView.postMessage(d.imei);}catch(e){}
      try{window.parent.postMessage({type:'markerTap',imei:d.imei},'*');}catch(e){}
    });
    markers[d.imei] = marker;
    if(d.selected){ marker.openPopup(); }
  })();
}

var selectedDevice = null;
for (var i = 0; i < devices.length; i++) {
  if (devices[i].selected) {
    selectedDevice = devices[i];
    break;
  }
}

if(selectedDevice) {
  map.setView([selectedDevice.lat, selectedDevice.lng], 16);
} else if(devices.length > 1){
  var markerList = [];
  for (var k in markers) {
    if (Object.prototype.hasOwnProperty.call(markers, k)) {
      markerList.push(markers[k]);
    }
  }
  var group = L.featureGroup(markerList);
  map.fitBounds(group.getBounds().pad(0.15));
}

window.selectDeviceByImei = function(imei) {
  if (!imei) {
    map.closePopup();
    var markerList = [];
    for (var k in markers) {
      if (Object.prototype.hasOwnProperty.call(markers, k)) {
        markerList.push(markers[k]);
      }
    }
    if (markerList.length > 1) {
      var group = L.featureGroup(markerList);
      map.fitBounds(group.getBounds().pad(0.15));
    }
    return;
  }
  var marker = markers[imei];
  if (marker) {
    var latLng = marker.getLatLng();
    map.setView(latLng, 16);
    marker.openPopup();
  }
};
</script>
</body>
</html>`;
}

import { WebView } from 'react-native-webview';

function MapWeb({ devices, selectedImei, onMarkerTap, theme, style }: Props) {
  const isFocused = useIsFocused();
  const webViewRef = useRef<WebView>(null);
  const safeDevices = Array.isArray(devices) ? devices : [];
  const { direction } = useLanguageStore();
  const html = buildMapHtml(safeDevices, selectedImei, theme || 'dark', direction);
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

  // Dynamically select device via injected JS on Native
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (webViewRef.current) {
      const js = `
        if (window.selectDeviceByImei) {
          window.selectDeviceByImei(${selectedImei ? `'${selectedImei}'` : 'null'});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [selectedImei]);

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
      {isFocused ? (
        <WebView
          ref={webViewRef}
          key={`live-device-map-${theme || 'dark'}`}
          originWhitelist={['*']}
          source={{ html }}
          style={{ flex: 1 }}
          containerStyle={{ width: '100%', height: '100%' }}
          onMessage={(event) => {
            const message = event.nativeEvent.data;
            // The leaflet script sends imei as a plain string inside window.ReactNativeWebView.postMessage(d.imei)
            if (message) {
              onTapRef.current(message);
            }
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default MapWeb;
export { buildMapHtml };
