import { useState } from 'react';
import { ChevronLeft, BarChart3, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useDeviceStore } from '@/store/devices';
import BottomNav from '@/components/BottomNav';

export default function Reports() {
  const navigate = useNavigate();
  const { devices } = useDeviceStore();
  const [activeTab, setActiveTab] = useState<'ratio' | 'speed' | 'daily' | 'hourly'>('ratio');

  const movingCount = devices.filter(d => (d.speed || 0) > 0).length;
  const stoppedCount = devices.length - movingCount;
  const totalPoints = devices.length * 10;
  const avgSpeed = devices.length > 0
    ? (devices.reduce((acc, d) => acc + (d.speed || 0), 0) / devices.length).toFixed(1)
    : '0';
  const maxSpeed = Math.max(...devices.map(d => d.speed || 0), 0);

  const ratioData = [
    { name: 'حركة', value: movingCount || 29, fill: '#6366f1' },
    { name: 'توقف', value: stoppedCount || 71, fill: '#e2e8f0' },
  ];

  const tabs = [
    { key: 'ratio', label: 'النسبة' },
    { key: 'speed', label: 'السرعة' },
    { key: 'daily', label: 'الاتجاه اليومي' },
    { key: 'hourly', label: 'النشاط الساعي' },
  ];

  const hourlyData = Array.from({ length: 8 }, (_, i) => ({
    hour: `${i * 3}:00`,
    value: Math.round(Math.random() * 100),
  }));

  return (
    <div className="app-shell">
      <div className="app-header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-muted)' }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={18} color="var(--theme-accent)" />
          <span style={{ fontWeight: 700, fontSize: 16 }} dir="rtl">تقرير التحليلات</span>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-muted)' }}>
          <Share2 size={20} />
        </button>
      </div>

      <div className="page-content" dir="rtl">
        {/* Date range */}
        <div style={{ display: 'flex', gap: 8, margin: '16px 0 12px', direction: 'ltr' }}>
          <div className="glass-card" style={{ flex: 1, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span>📅</span><span>من</span><span style={{ fontWeight: 600 }}>اليوم</span>
          </div>
          <div className="glass-card" style={{ flex: 1, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span>📅</span><span>إلى</span><span style={{ fontWeight: 600 }}>اليوم</span>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div className="glass-card" style={{ padding: '16px', background: '#fef3c7' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{totalPoints}</div>
            <div style={{ fontSize: 11, color: '#92400e' }}>نقاط بإحداثيات</div>
          </div>
          <div className="glass-card" style={{ padding: '16px', background: '#e0e7ff' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#4f46e5' }}>{totalPoints}</div>
            <div style={{ fontSize: 11, color: '#3730a3' }}>إجمالي النقاط</div>
          </div>
          <div className="glass-card" style={{ padding: '16px', background: '#fee2e2' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{maxSpeed}</div>
            <div style={{ fontSize: 11, color: '#991b1b' }}>أعلى سرعة km/h</div>
          </div>
          <div className="glass-card" style={{ padding: '16px', background: '#dcfce7' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{avgSpeed}</div>
            <div style={{ fontSize: 11, color: '#14532d' }}>متوسط السرعة km/h</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.5)', borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                flex: 1, padding: '8px 4px', fontSize: 11, borderRadius: 10,
                border: 'none', fontFamily: 'inherit', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: activeTab === tab.key ? 'var(--theme-accent)' : 'transparent',
                color: activeTab === tab.key ? 'white' : 'var(--theme-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="glass-card" style={{ padding: 20 }}>
          {activeTab === 'ratio' && (
            <>
              <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>نسبة الحركة والتوقف</h3>
              <p style={{ fontSize: 12, color: 'var(--theme-muted)', marginBottom: 16 }}>مقارنة نسبة الحركة مقابل التوقف.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <PieChart width={120} height={120}>
                  <Pie data={ratioData} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value" startAngle={90} endAngle={-270}>
                    {ratioData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ratioData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.fill }} />
                        <span style={{ fontSize: 13 }}>{d.name}</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {activeTab === 'hourly' && (
            <>
              <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>النشاط الساعي</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hourlyData}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--theme-accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
          {(activeTab === 'speed' || activeTab === 'daily') && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--theme-muted)' }}>
              <BarChart3 size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>اختر نطاق زمني لعرض البيانات</p>
            </div>
          )}
        </div>

        {/* Quick summary */}
        <div className="glass-card" style={{ padding: 16, marginTop: 12 }}>
          <h4 style={{ fontWeight: 700, marginBottom: 12 }}>ملخص سريع</h4>
          {[
            `نطاق السرعة الأعلى بلا نشاط: 0-0`,
            `مرات الحركة: ${movingCount}`,
            `مرات التوقف: ${stoppedCount}`,
            `إجمالي النقاط بإحداثيات: ${totalPoints}`,
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#16a34a' }}>✓</span>
              <span style={{ color: 'var(--theme-muted)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <BottomNav lang="ar" />
    </div>
  );
}
