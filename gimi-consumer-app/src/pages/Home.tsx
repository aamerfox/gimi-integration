import { useNavigate } from 'react-router-dom';
import { useDeviceStore } from '@/store/devices';
import { isRecent } from '@/utils/time';
import { Map, Grid2X2, MapPin, BarChart3, Settings, UserCircle, Plus } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';

const navCards = [
  { path: '/map', icon: Map, color: '#e0e7ff', iconColor: '#6366f1', labelAr: 'الخريطة', descAr: 'تتبع مواقع الأجهزة الذكية على الخريطة' },
  { path: '/devices', icon: Grid2X2, color: '#fef3c7', iconColor: '#d97706', labelAr: 'قائمة الأجهزة الذكية', descAr: 'عرض وإدارة جميع الأجهزة الذكية ...' },
  { path: '/geofences', icon: MapPin, color: '#dcfce7', iconColor: '#16a34a', labelAr: 'المناطق الجغرافية', descAr: 'إدارة وعرض جميع المناطق الجغر...' },
  { path: '/reports', icon: BarChart3, color: '#e0f2fe', iconColor: '#0ea5e9', labelAr: 'التقارير', descAr: 'تحليلات وملخصات أداء الأجهزة ال...' },
  { path: '/settings', icon: Settings, color: '#ffe4e6', iconColor: '#f43f5e', labelAr: 'الإعدادات', descAr: 'تغيير اللغة وإعدادات التطبيق' },
  { path: '/profile', icon: UserCircle, color: '#f3e8ff', iconColor: '#9333ea', labelAr: 'الملف الشخصي', descAr: 'إدارة معلوماتك الشخصية' },
];

export default function Home() {
  const navigate = useNavigate();
  const { devices } = useDeviceStore();

  const total = devices.length;
  const online = devices.filter(d => d.status === '1' || d.posType === 'GPS' || isRecent(d.sysTime)).length;
  const offline = total - online;
  const avgBattery = total > 0
    ? Math.round(devices.reduce((acc, d) => acc + (parseInt(d.batteryPowerVal || '0') || 0), 0) / total)
    : 0;

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="page-content" dir="rtl">
        {/* Smart Stats Panel */}
        <div className="glass-card" style={{ margin: '16px 0 12px', padding: '18px 20px' }}>
          <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
            لوحة التحكم الذكية
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <StatTile value={total} label="إجمالي الأجهزة" color="#dbeafe" textColor="#2563eb" />
            <StatTile value={online} label="نشطة" color="#dcfce7" textColor="#16a34a" />
            <StatTile value={offline} label="غير نشطة" color="#fee2e2" textColor="#dc2626" />
            <StatTile value={`${avgBattery}%`} label="متوسط البطارية" color="#fef3c7" textColor="#d97706" />
          </div>
        </div>

        {/* Navigation Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {navCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.path}
                className="glass-card nav-card"
                onClick={() => navigate(card.path)}
              >
                <div className="nav-icon-wrap" style={{ background: card.color }}>
                  <Icon size={26} color={card.iconColor} strokeWidth={1.8} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--theme-text)', marginBottom: 4 }}>
                    {card.labelAr}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--theme-muted)', lineHeight: 1.4 }}>
                    {card.descAr}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* FAB */}
        <button className="fab-bar" onClick={() => navigate('/devices')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 6, display: 'flex' }}>
              <Plus size={18} />
            </div>
            <span>إضافة جهاز ذكي جديد</span>
          </div>
          <div style={{ display: 'flex', gap: 3, opacity: 0.6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />
          </div>
        </button>
      </div>
      <BottomNav lang="ar" />
    </div>
  );
}

function StatTile({ value, label, color, textColor }: { value: number | string; label: string; color: string; textColor: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-bubble" style={{ background: color, color: textColor }}>
        {value}
      </div>
      <span style={{ fontSize: 10, color: 'var(--theme-muted)', textAlign: 'center', lineHeight: 1.3, fontWeight: 500 }}>
        {label}
      </span>
    </div>
  );
}
