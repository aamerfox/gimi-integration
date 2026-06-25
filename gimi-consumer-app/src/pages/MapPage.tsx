import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDeviceStore } from '@/store/devices';
import { isRecent } from '@/utils/time';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createDeviceIcon(isOnline: boolean) {
  return L.divIcon({
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${isOnline ? '#22c55e' : '#94a3b8'};
      border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      font-size:16px;
    ">🚗</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export default function MapPage() {
  const { devices, selectedDevice, setSelectedDevice } = useDeviceStore();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);

  const validDevices = devices.filter(d => d.lat && d.lng);
  const center: [number, number] = selectedDevice?.lat && selectedDevice?.lng
    ? [selectedDevice.lat, selectedDevice.lng]
    : validDevices.length > 0
    ? [validDevices[0].lat!, validDevices[0].lng!]
    : [24.7136, 46.6753];

  useEffect(() => {
    if (selectedDevice?.lat && selectedDevice?.lng && mapRef.current) {
      mapRef.current.flyTo([selectedDevice.lat!, selectedDevice.lng!], 15, { animate: true, duration: 1 });
    }
  }, [selectedDevice]);

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="app-header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-muted)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16 }} dir="rtl">الخريطة المباشرة</span>
        <span style={{ fontSize: 11, color: 'var(--theme-muted)' }}>{validDevices.length} جهاز</span>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {validDevices.map(device => {
            const isOnline = device.status === '1' || device.posType === 'GPS' || isRecent(device.sysTime);
            return (
              <Marker
                key={device.imei}
                position={[device.lat!, device.lng!]}
                icon={createDeviceIcon(isOnline)}
                eventHandlers={{ click: () => setSelectedDevice(device) }}
              >
                <Popup>
                  <div dir="rtl" style={{ fontFamily: 'IBM Plex Sans Arabic, sans-serif', minWidth: 160 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{device.deviceName}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{device.imei}</div>
                    <span className={isOnline ? 'badge-online' : 'badge-offline'}>
                      {isOnline ? 'نشطة' : 'غير نشطة'}
                    </span>
                    {device.speed !== undefined && (
                      <div style={{ fontSize: 12, marginTop: 6 }}>السرعة: {device.speed} km/h</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Selected device bottom info */}
        {selectedDevice && (
          <div style={{
            position: 'absolute', bottom: 80, left: 12, right: 12, zIndex: 1000,
            background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '14px 18px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)', backdropFilter: 'blur(10px)',
          }} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedDevice.deviceName}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{selectedDevice.imei}</div>
              </div>
              <div style={{ textAlign: 'left', fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{selectedDevice.speed || 0} km/h</div>
                <div style={{ color: '#64748b', fontSize: 11 }}>السرعة</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav lang="ar" />
    </div>
  );
}
