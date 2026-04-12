import { useState } from 'react';
import { useDeviceStore } from '@/store/devices';
import { Search, Map as MapIcon, List, MoreVertical, Battery, BatteryMedium, BatteryFull, QrCode } from 'lucide-react';
import { formatGimiTime, isRecent } from '@/utils/time';
import LiveMap from '@/components/LiveMap';

export default function Devices() {
    const { devices } = useDeviceStore();
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredDevices = devices.filter((d) => 
        d.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.imei.includes(searchQuery)
    );

    const getBatteryIcon = (powerLevel: number) => {
        if (powerLevel >= 80) return <BatteryFull size={16} className="text-emerald-500" />;
        if (powerLevel >= 30) return <BatteryMedium size={16} className="text-emerald-500" />;
        return <Battery size={16} className="text-rose-500" />;
    };

    return (
        <div className="min-h-full p-4 pb-20 max-w-2xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <button className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <QrCode size={20} className="text-slate-700 dark:text-slate-300" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white">الأجهزة الذكية</h1>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button 
                        onClick={() => setViewMode('map')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'map' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
                    >
                        <MapIcon size={18} />
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
                    >
                        <List size={18} />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                    <Search size={18} className="text-slate-400" />
                </div>
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200 dark:border-slate-700 text-slate-900 text-sm rounded-2xl focus:ring-indigo-500 focus:border-indigo-500 block w-full ps-10 p-3.5 dark:text-white placeholder-slate-400" 
                    placeholder="ابحث بالاسم أو الكود..." 
                    dir="auto"
                />
            </div>

            {/* Title / Counter */}
            <div className="pt-2">
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    الأجهزة الذكية ({filteredDevices.length})
                </h2>
                <p className="text-xs text-slate-400 mt-1">تابع الحالة والعدد ثم افتح الخريطة للتفاصيل.</p>
            </div>

            {/* Device Grid OR Map */}
            {viewMode === 'map' ? (
                <div className="mt-4 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm" style={{ height: 'calc(100vh - 220px)' }}>
                    <LiveMap />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 mt-4">
                    {filteredDevices.map(device => {
                        const isOnline = device.status === '1' || device.posType === 'GPS' || isRecent(device.sysTime || '');
                        const batteryPower = parseInt(device.batteryPowerVal || '0') || 0;
                        
                        return (
                            <div key={device.imei} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
                                {/* Card Header: Context Menu & Status */}
                                <div className="flex justify-between items-start mb-3">
                                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                        <MoreVertical size={16} />
                                    </button>
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        isOnline 
                                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                        : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                        <span>{isOnline ? 'نشطة' : 'غير نشطة'}</span>
                                    </div>
                                </div>
                                
                                {/* Device Info */}
                                <div className="text-center mb-3">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto mb-2 flex items-center justify-center">
                                        <span className="text-lg">🏎️</span>
                                    </div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm truncate">{device.deviceName}</h3>
                                    <p className="text-[9px] text-slate-400 mt-0.5 truncate">{device.imei}</p>
                                </div>

                                {/* Card Footer: Last Update & Battery */}
                                <div className="flex items-center justify-between mt-auto border-t border-slate-100 dark:border-slate-700/50 pt-2">
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                        <span>⏱️</span>
                                        <span>{formatGimiTime(device.sysTime)}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                        {getBatteryIcon(batteryPower)}
                                        <span>%{device.batteryPowerVal || '--'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredDevices.length === 0 && (
                        <div className="col-span-2 text-center py-10 text-slate-500">
                            لا توجد أجهزة مطابقة للبحث
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
