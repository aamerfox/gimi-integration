import { useState, useRef, useEffect } from 'react';
import { useGeofenceStore, type LocalGeofence } from '@/store/geofences';
import { MapPin, MoreVertical, Plus, Layers } from 'lucide-react';
import L from 'leaflet';

export default function B2CGeofenceMobile() {
    const { geofences, removeGeofence } = useGeofenceStore();
    const [selectedFence, setSelectedFence] = useState<LocalGeofence | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [formRadius, setFormRadius] = useState(100);

    // Initialize Map for Modal
    useEffect(() => {
        if (!containerRef.current || mapRef.current || (!selectedFence && !isCreating)) return;

        const streetLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { 
            attribution: 'Map data &copy; <a href="https://www.google.com/maps">Google</a>', 
            maxZoom: 19 
        });

        const lat = selectedFence?.lat || 24.67358;
        const lng = selectedFence?.lng || 46.81697;

        const map = L.map(containerRef.current, {
            center: [lat, lng],
            zoom: 15,
            zoomControl: false,
            layers: [streetLayer]
        });

        mapRef.current = map;
        setTimeout(() => { map.invalidateSize(); setMapReady(true); }, 150);

        // Draw Circle
        L.circle([lat, lng], {
            radius: selectedFence?.radius || formRadius,
            color: '#4f46e5', // indigo-600
            fillColor: '#4f46e5',
            fillOpacity: 0.2,
            weight: 2,
        }).addTo(map);

        L.marker([lat, lng], {
            icon: L.divIcon({
                className: '',
                html: `<div style="color: #dc2626; display: flex; align-items: center; justify-content: center;"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg></div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
            })
        }).addTo(map);

        return () => { map.remove(); mapRef.current = null; };
    }, [selectedFence, isCreating, formRadius]);

    return (
        <div className="min-h-full p-4 pb-20 max-w-2xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <Layers size={20} className="text-slate-700 dark:text-slate-300" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white">المناطق الجغرافية</h1>
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {geofences.map((gf) => (
                    <div key={gf.id} className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => setSelectedFence(gf)}>
                        <button onClick={(e) => { e.stopPropagation(); removeGeofence(gf.id); }} className="p-2 text-slate-400 hover:text-rose-500">
                            <MoreVertical size={20} />
                        </button>
                        <div className="text-right flex-1 ml-4 rtl:mr-4">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">{gf.fenceName}</h3>
                            <p className="text-xs text-slate-500 mt-1">دائرة | #{gf.id.slice(0,4)}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{gf.lat?.toFixed(5)}, {gf.lng?.toFixed(5)}</p>
                            <p className="text-[10px] text-slate-400 mt-1">نصف القطر {gf.radius} م</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-500 shrink-0">
                            <MapPin size={24} />
                        </div>
                    </div>
                ))}

                {geofences.length === 0 && (
                    <div className="text-center py-10 text-slate-500 text-sm">
                        لا توجد مناطق محفوظة. اضغط على رمز الإضافة.
                    </div>
                )}
            </div>

            {/* Floating Action Button */}
            <button 
                onClick={() => setIsCreating(true)}
                className="fixed bottom-24 left-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 z-50">
                <Plus size={24} />
            </button>

            {/* Modal Overlay */}
            {(selectedFence || isCreating) && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200">
                        {/* Header Modal */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                            <button onClick={() => { setSelectedFence(null); setIsCreating(false); }} className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 rounded-full text-xs font-bold">
                                دائرة
                            </button>
                            <div className="text-center flex-1">
                                <h3 className="font-bold text-slate-800 dark:text-white text-sm">تفاصيل المنطقة</h3>
                                <p className="text-xs text-slate-500">{selectedFence?.fenceName || 'منطقة جديدة'}</p>
                            </div>
                            <div className="w-8 h-8 flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 rounded-full">
                                <Layers size={16} />
                            </div>
                        </div>

                        {/* Map Canvas */}
                        <div className="w-full h-[280px] bg-slate-100 dark:bg-slate-800 relative z-0">
                            <div ref={containerRef} className="w-full h-full" />
                        </div>

                        {/* Radius Slider / Info */}
                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">نصف القطر: m {selectedFence?.radius || formRadius}</span>
                                <input type="range" min={50} max={5000} step={50} value={selectedFence?.radius || formRadius} disabled={!!selectedFence} onChange={(e) => setFormRadius(Number(e.target.value))} className="w-1/2 accent-indigo-600" />
                                <span className="text-xs text-slate-500">المعرف: {selectedFence?.id.slice(0,2) || '10'}</span>
                            </div>

                            {/* Actions */}
                            <button onClick={() => { setSelectedFence(null); setIsCreating(false); }} className="w-full py-4 text-center text-sm font-bold text-indigo-600 border border-indigo-200 dark:border-indigo-800 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
