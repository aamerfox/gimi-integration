import { useNavigate } from 'react-router-dom';
import { useDeviceStore } from '@/store/devices';
import { Map, MapPin, Grid2X2, BarChart3, Settings, UserCircle, Plus } from 'lucide-react';
import { isRecent } from '@/utils/time';

export default function B2CDashboardOverlay() {
    const navigate = useNavigate();
    const { devices } = useDeviceStore();

    const totalDevices = devices.length;
    const onlineCount = devices.filter((d) => d.status === '1' || d.posType === 'GPS' || isRecent(d.sysTime || '')).length;
    const offlineCount = totalDevices - onlineCount;

    // Calculate approximate battery average 
    const avgBattery = totalDevices > 0 
        ? Math.round(devices.reduce((acc, d) => acc + (parseInt(d.batteryPowerVal || '0') || 0), 0) / totalDevices)
        : 0;

    return (
        <div className="absolute inset-x-0 bottom-0 top-[10vh] pointer-events-none flex flex-col justify-end p-4 pb-[80px]">
            {/* Top Stat Panel */}
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-3xl p-5 mb-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] pointer-events-auto transition-transform duration-300 transform translate-y-0">
                <h2 className="text-center font-bold text-slate-800 dark:text-white mb-4 text-lg">لوحة التحكم الذكية</h2>
                
                <div className="grid grid-cols-4 gap-2 text-center rtl:divide-x-reverse divide-x divide-slate-200 dark:divide-slate-700">
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 flex items-center justify-center mb-1">
                            <span className="font-bold text-sm">{totalDevices}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">إجمالي الأجهزة</span>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center mb-1">
                            <span className="font-bold text-sm">{onlineCount}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">نشطة</span>
                    </div>

                    <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 flex items-center justify-center mb-1">
                            <span className="font-bold text-sm">{offlineCount}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">غير نشطة</span>
                    </div>

                    <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 flex items-center justify-center mb-1">
                            <span className="font-bold text-sm">%{avgBattery}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">البطارية</span>
                    </div>
                </div>
            </div>

            {/* Application Navigation Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4 pointer-events-auto">
                <button onClick={() => navigate('/')} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-3xl p-5 flex flex-col items-center text-center shadow-sm hover:scale-[1.02] active:scale-95 transition-all">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-500 mb-3">
                        <Map size={24} />
                    </div>
                    <span className="font-bold text-slate-800 dark:text-white text-sm mb-1">الخريطة</span>
                    <span className="text-[10px] text-slate-500">تتبع مواقع الأجهزة</span>
                </button>

                <button onClick={() => navigate('/devices')} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-3xl p-5 flex flex-col items-center text-center shadow-sm hover:scale-[1.02] active:scale-95 transition-all">
                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 mb-3">
                        <Grid2X2 size={24} />
                    </div>
                    <span className="font-bold text-slate-800 dark:text-white text-sm mb-1">قائمة الأجهزة</span>
                    <span className="text-[10px] text-slate-500">إدارة الأجهزة الذكية</span>
                </button>

                <button onClick={() => navigate('/geofences')} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-3xl p-5 flex flex-col items-center text-center shadow-sm hover:scale-[1.02] active:scale-95 transition-all">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500 mb-3">
                        <MapPin size={24} />
                    </div>
                    <span className="font-bold text-slate-800 dark:text-white text-sm mb-1">المناطق</span>
                    <span className="text-[10px] text-slate-500">إدارة المناطق الجغرافية</span>
                </button>

                <button onClick={() => navigate('/history')} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-3xl p-5 flex flex-col items-center text-center shadow-sm hover:scale-[1.02] active:scale-95 transition-all">
                    <div className="w-12 h-12 bg-sky-50 dark:bg-sky-500/20 rounded-2xl flex items-center justify-center text-sky-500 mb-3">
                        <BarChart3 size={24} />
                    </div>
                    <span className="font-bold text-slate-800 dark:text-white text-sm mb-1">التقارير</span>
                    <span className="text-[10px] text-slate-500">تحليلات الأداء والمسارات</span>
                </button>

                <button onClick={() => navigate('/settings')} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-3xl p-5 flex flex-col items-center text-center shadow-sm hover:scale-[1.02] active:scale-95 transition-all">
                    <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500 mb-3">
                        <Settings size={24} />
                    </div>
                    <span className="font-bold text-slate-800 dark:text-white text-sm mb-1">الإعدادات</span>
                    <span className="text-[10px] text-slate-500">تغيير اللغة والسمات</span>
                </button>

                <button className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-3xl p-5 flex flex-col items-center text-center shadow-sm hover:scale-[1.02] active:scale-95 transition-all">
                    <div className="w-12 h-12 bg-purple-50 dark:bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-500 mb-3">
                        <UserCircle size={24} />
                    </div>
                    <span className="font-bold text-slate-800 dark:text-white text-sm mb-1">حسابي</span>
                    <span className="text-[10px] text-slate-500">إدارة معلوماتك الشخصية</span>
                </button>
            </div>

            {/* Quick Add FAB */}
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg rounded-2xl p-4 flex items-center justify-between w-full pointer-events-auto transition-all active:scale-[0.98]">
                <div className="flex items-center gap-3 rtl:flex-row-reverse">
                    <div className="bg-white/20 p-2 rounded-xl">
                        <Plus size={20} />
                    </div>
                    <span className="font-bold whitespace-nowrap">إضافة جهاز ذكي جديد</span>
                </div>
                <div className="flex space-x-1 rtl:space-x-reverse opacity-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                </div>
            </button>
        </div>
    );
}
