import { Bell, Search, MessageCircle } from 'lucide-react';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export default function AppHeader({ title = 'تريس+', subtitle = 'trace+ Tracking' }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'color-mix(in srgb, var(--theme-accent) 12%, transparent)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--theme-accent)',
          }}
        >
          <Bell size={18} />
        </button>
        <button
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#dcfce7',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#16a34a',
          }}
        >
          <MessageCircle size={18} />
        </button>
        <button
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--theme-muted)',
          }}
        >
          <Search size={18} />
        </button>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div dir="ltr" style={{ fontWeight: 700, fontSize: 16, color: 'var(--theme-accent)', direction: 'ltr' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--theme-muted)', fontFamily: 'Inter, sans-serif' }}>
          {subtitle}
        </div>
      </div>

      <img
        src="/logo-icon.png"
        alt="trace+ icon"
        className="brand-logo-icon"
        style={{
          width: 44,
          height: 44,
          objectFit: 'contain',
        }}
      />
    </header>
  );
}
