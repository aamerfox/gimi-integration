import { ChevronLeft, Bell, Moon, Users, ChevronRight, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, type Theme } from '@/store/app';
import { useAuthStore } from '@/store/auth';
import i18n from '@/i18n';
import BottomNav from '@/components/BottomNav';
import { useTranslation } from 'react-i18next';

const themes: { key: Theme; labelAr: string; gradient: string }[] = [
  { key: 'default', labelAr: 'عادي',           gradient: 'linear-gradient(135deg, #e8e4f8, #7c6fe0)' },
  { key: 'oasis',   labelAr: 'واحة',           gradient: 'linear-gradient(135deg, #d4f5ed, #0d9488)' },
  { key: 'sunset',  labelAr: 'غروب',           gradient: 'linear-gradient(135deg, #fde8d8, #f97316)' },
  { key: 'engineer',labelAr: 'الهوية المؤسسية',   gradient: 'linear-gradient(135deg, #dde8ff, #2563eb)' },
  { key: 'forest',  labelAr: 'غابة',           gradient: 'linear-gradient(135deg, #d1ead8, #16a34a)' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, lang, notificationsEnabled, darkMode, setTheme, setLang, setNotifications, setDarkMode } = useAppStore();
  const { logout } = useAuthStore();
  const { t } = useTranslation();

  const handleLangSwitch = (newLang: 'ar' | 'en') => {
    setLang(newLang);
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  const handleTheme = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t === 'default' ? '' : t);
  };

  return (
    <div className="app-shell">
      <div className="app-header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-muted)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16 }} dir="rtl">{t('settings.title')}</span>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-content" dir="rtl">
        {/* Settings top icon */}
        <div style={{ textAlign: 'center', padding: '20px 0 4px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
            background: 'color-mix(in srgb, var(--theme-accent) 12%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 26 }}>⚙️</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{t('settings.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--theme-muted)' }}>{t('settings.generalSettings')}</div>
        </div>

        {/* General */}
        <div style={{ fontSize: 12, color: 'var(--theme-muted)', padding: '16px 4px 8px', fontWeight: 600 }}>{t('settings.generalSettings')}</div>

        {/* Notifications */}
        <div className="glass-card" style={{ padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Bell size={20} color="var(--theme-accent)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.notifications')}</div>
                <div style={{ fontSize: 11, color: 'var(--theme-muted)' }}>استقبل التنبيهات عند مغد الإشارة أو انخفاض البطارية...</div>
              </div>
            </div>
            <Toggle value={notificationsEnabled} onChange={setNotifications} />
          </div>
        </div>

        {/* Dark mode */}
        <div className="glass-card" style={{ padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Moon size={20} color="var(--theme-accent)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.darkMode')}</div>
                <div style={{ fontSize: 11, color: 'var(--theme-muted)' }}>تفعيل الوضع الداكن في جميع الشاشات</div>
              </div>
            </div>
            <Toggle value={darkMode} onChange={setDarkMode} />
          </div>
        </div>

        {/* Language */}
        <div style={{ fontSize: 12, color: 'var(--theme-muted)', padding: '12px 4px 8px', fontWeight: 600 }}>{t('settings.language')}</div>
        <div className="glass-card" style={{ padding: '10px 12px', marginBottom: 10, display: 'flex', gap: 8 }}>
          {(['ar', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => handleLangSwitch(l)}
              style={{
                flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid',
                borderColor: lang === l ? 'var(--theme-accent)' : 'transparent',
                background: lang === l ? 'color-mix(in srgb, var(--theme-accent) 10%, transparent)' : 'rgba(255,255,255,0.5)',
                fontFamily: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                color: lang === l ? 'var(--theme-accent)' : 'var(--theme-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {l === 'ar' ? '🇸🇦 العربية' : '🇺🇸 الإنجليزية'}
              {lang === l && <span style={{ color: 'var(--theme-accent)' }}>✓</span>}
            </button>
          ))}
        </div>

        {/* Users & permissions */}
        <div className="glass-card" style={{ padding: '14px 16px', marginBottom: 10, cursor: 'pointer' }} onClick={() => {}}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Users size={20} color="var(--theme-accent)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.usersPermissions')}</div>
                <div style={{ fontSize: 11, color: 'var(--theme-muted)' }}>إدارة مستخدمي المعايرة وصلاحياتهم</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--theme-muted)" />
          </div>
        </div>

        {/* Themes */}
        <div style={{ fontSize: 12, color: 'var(--theme-muted)', padding: '12px 4px 8px', fontWeight: 600 }}>{t('settings.appThemes')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {themes.map(t => (
            <button
              key={t.key}
              onClick={() => handleTheme(t.key)}
              style={{
                border: '2.5px solid',
                borderColor: theme === t.key ? 'var(--theme-accent)' : 'transparent',
                borderRadius: 16, overflow: 'hidden',
                cursor: 'pointer', padding: 0, background: 'none',
                position: 'relative',
              }}
            >
              <div style={{ height: 64, background: t.gradient }} />
              <div style={{
                padding: '6px', fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
                background: 'rgba(255,255,255,0.8)', color: 'var(--theme-text)',
              }}>
                {t.labelAr}
              </div>
              {theme === t.key && (
                <div style={{
                  position: 'absolute', top: 6, left: 6,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--theme-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: 'white', fontSize: 12 }}>✓</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{
            width: '100%', padding: '14px', border: 'none', borderRadius: 14,
            background: '#fef2f2', color: '#dc2626',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 20,
          }}
        >
          <LogOut size={16} />
          {t('auth.logout')}
        </button>
      </div>
      <BottomNav lang={lang} />
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
        background: value ? 'var(--theme-accent)' : '#e2e8f0',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
        background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
        left: value ? 25 : 3,
      }} />
    </button>
  );
}
