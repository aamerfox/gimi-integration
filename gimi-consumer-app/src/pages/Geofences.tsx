import { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Plus, MoreVertical, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuthStore } from '@/store/auth';
import { gimiService } from '@/services/gimi';
import BottomNav from '@/components/BottomNav';

interface Geofence {
  fenceId: string;
  fenceName: string;
  fenceType: string;
  lat?: number;
  lng?: number;
  radius?: number;
}

export default function Geofences() {
  const navigate = useNavigate();
  const { accessToken, userId } = useAuthStore();
  const [fences, setFences] = useState<Geofence[]>([]);
  const [selected, setSelected] = useState<Geofence | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    gimiService.getGeofences(accessToken, userId || '').then(res => {
      const resp = res as any;
      const list = resp?.data || resp?.result || [];
      if (Array.isArray(list)) setFences(list);
    }).catch(() => {});
  }, [accessToken, userId]);

  const fenceTypes: Record<string, string> = { CIRCLE: 'دائرة', POLYGON: 'مضلع' };

  return (
    <div className="app-shell">
      <div className="app-header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-muted)' }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} color="var(--theme-accent)" />
          <span style={{ fontWeight: 700, fontSize: 16 }} dir="rtl">المناطق الجغرافية</span>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-accent)' }}>
          <Plus size={22} />
        </button>
      </div>

      <div className="page-content" dir="rtl">
        {fences.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--theme-muted)' }}>
            <MapPin size={48} style={{ margin: '0 auto 16px', opacity: 0.3, display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>لا توجد مناطق جغرافية</p>
            <p style={{ fontSize: 13 }}>أضف منطقة جغرافية لتتبع دخول وخروج أجهزتك</p>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fences.map((fence, i) => (
              <div
                key={fence.fenceId || i}
                className="glass-card"
                style={{ padding: '14px 16px', cursor: 'pointer' }}
                onClick={() => setSelected(fence)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'color-mix(in srgb, var(--theme-accent) 12%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Navigation size={20} color="var(--theme-accent)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{fence.fenceName}</div>
                    <div style={{ fontSize: 11, color: 'var(--theme-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{fenceTypes[fence.fenceType] || fence.fenceType}</span>
                      {fence.lat && fence.lng && (
                        <span dir="ltr">{fence.lat?.toFixed(4)} | {fence.lng?.toFixed(4)}</span>
                      )}
                      {fence.radius && <span>نصف القطر {fence.radius * 100} م</span>}
                    </div>
                  </div>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-muted)', padding: 4 }}>
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom sheet map preview */}
      {selected && (
        <>
          <div className="sheet-overlay" onClick={() => setSelected(null)} />
          <div className="bottom-sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} dir="rtl">
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>تفاصيل المنطقة</div>
                <div style={{ fontSize: 13, color: 'var(--theme-muted)' }}>{selected.fenceName}</div>
              </div>
              <span style={{
                background: 'color-mix(in srgb, var(--theme-accent) 12%, transparent)',
                color: 'var(--theme-accent)', fontSize: 12, fontWeight: 600,
                padding: '4px 12px', borderRadius: 999,
              }}>
                {fenceTypes[selected.fenceType] || selected.fenceType}
              </span>
            </div>

            {selected.lat && selected.lng ? (
              <div style={{ flex: 1, minHeight: 200, maxHeight: 260 }}>
                <MapContainer
                  center={[selected.lat, selected.lng]}
                  zoom={15}
                  style={{ height: 220, width: '100%' }}
                  zoomControl={false}
                  scrollWheelZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[selected.lat, selected.lng]} icon={L.divIcon({ html: '<div style="width:12px;height:12px;background:red;border-radius:50%;border:2px solid white"></div>', className: '', iconSize: [12, 12], iconAnchor: [6, 6] })} />
                  {selected.radius && (
                    <Circle center={[selected.lat, selected.lng]} radius={selected.radius * 100} color="var(--theme-accent)" fillOpacity={0.15} />
                  )}
                </MapContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--theme-muted)', fontSize: 13 }}>
                لا تتوفر بيانات موقع للمنطقة
              </div>
            )}

            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }} dir="rtl">
              {selected.radius && (
                <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
                  <span style={{ color: 'var(--theme-muted)' }}>نصف القطر</span>
                  <span style={{ fontWeight: 700, marginRight: 6 }}>{selected.radius * 100} م</span>
                </div>
              )}
            </div>

            <div style={{ padding: '0 16px 20px' }}>
              <button
                onClick={() => setSelected(null)}
                style={{
                  width: '100%', padding: '13px',
                  background: '#f1f5f9', border: 'none', borderRadius: 14,
                  fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', color: '#475569',
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </>
      )}

      <BottomNav lang="ar" />
    </div>
  );
}
