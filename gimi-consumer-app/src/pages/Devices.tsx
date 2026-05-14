import { useState } from 'react';
import { Search, Battery, Clock, ChevronLeft, Map } from 'lucide-react';
import { useDeviceStore } from '@/store/devices';
import { useNavigate } from 'react-router-dom';
import { isRecent, formatGimiTime } from '@/utils/time';
import BottomNav from '@/components/BottomNav';

export default function Devices() {
  const { devices, setSelectedDevice } = useDeviceStore();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const filtered = devices.filter(d =>
    d.deviceName?.toLowerCase().includes(query.toLowerCase()) ||
    d.imei?.includes(query)
  );

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="app-header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-muted)' }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Map size={18} color="var(--theme-accent)" />
          <span style={{ fontWeight: 700, fontSize: 16 }} dir="rtl">الأجهزة الذكية</span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-content" dir="rtl">
        {/* Search */}
        <div style={{ position: 'relative', margin: '16px 0 12px' }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)', color: 'var(--theme-muted)', pointerEvents: 'none' }} />
          <input
            className="search-input"
            placeholder="ابحث بالاسم أو الجهاز الذكي أو الكود أو الموق..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            dir="rtl"
          />
        </div>

        {/* Count label */}
        <div className="glass-card" style={{ padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Map size={16} color="var(--theme-accent)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text)' }}>
            الأجهزة الذكية ({filtered.length})
          </span>
          <span style={{ fontSize: 11, color: 'var(--theme-muted)' }}>
            تابع الحالة والعدد ثم افتح الخريطة للتفاصيل
          </span>
        </div>

        {/* Device Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {filtered.map(device => {
            const isOnline = device.status === '1' || device.posType === 'GPS' || isRecent(device.sysTime);
            return (
              <button
                key={device.imei}
                className="glass-card"
                style={{ padding: 14, textAlign: 'right', cursor: 'pointer', border: 'none', fontFamily: 'inherit', width: '100%' }}
                onClick={() => { setSelectedDevice(device); navigate('/map'); }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: 'linear-gradient(135deg, #e2e8f0, #f8fafc)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 20 }}>🚗</span>
                  </div>
                  <span className={isOnline ? 'badge-online' : 'badge-offline'}>
                    {isOnline ? 'نشطة' : 'غير نشطة'}
                  </span>
                </div>

                {/* Name */}
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--theme-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {device.deviceName || 'جهاز غير مسمى'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--theme-muted)', marginBottom: 8, direction: 'ltr', textAlign: 'right' }}>
                  {device.imei}
                </div>

                {/* Battery & time */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--theme-muted)' }}>
                    <Battery size={12} />
                    {device.batteryPowerVal || '—'}%
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--theme-muted)' }}>
                    <Clock size={12} />
                    {formatGimiTime(device.sysTime || device.gpsTime).split(' ')[1] || '—'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--theme-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
            <p>لا توجد أجهزة</p>
          </div>
        )}
      </div>
      <BottomNav lang="ar" />
    </div>
  );
}
