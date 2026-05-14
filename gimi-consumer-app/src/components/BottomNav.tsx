import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MapPin, Map, BarChart3, Settings } from 'lucide-react';

const tabs = [
  { path: '/', icon: Home, labelAr: 'الرئيسية', labelEn: 'Home' },
  { path: '/devices', icon: MapPin, labelAr: 'أجهزتي', labelEn: 'Devices' },
  { path: '/map', icon: Map, labelAr: 'الخريطة', labelEn: 'Map' },
  { path: '/reports', icon: BarChart3, labelAr: 'التقارير', labelEn: 'Reports' },
  { path: '/settings', icon: Settings, labelAr: 'الإعدادات', labelEn: 'Settings' },
];

export default function BottomNav({ lang = 'ar' }: { lang?: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        const Icon = tab.icon;
        return (
          <button
            key={tab.path}
            className={`bottom-nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span>{lang === 'ar' ? tab.labelAr : tab.labelEn}</span>
          </button>
        );
      })}
    </nav>
  );
}
