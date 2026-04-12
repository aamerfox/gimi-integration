import { useTranslation } from 'react-i18next';
import { Moon, Sun, Bell, Shield, Palette, ChevronRight } from 'lucide-react';
import { useThemeStore } from '@/store/theme';
import { useLanguageStore } from '@/store/languageStore';

const Settings = () => {
    const { t } = useTranslation();
    const { theme, toggleTheme } = useThemeStore();
    const { language, toggleLanguage } = useLanguageStore();

    return (
        <div className="min-h-full p-4 pb-20 max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
                {t('settings.title', 'الإعدادات')}
            </h1>

            {/* General Settings Section */}
            <div className="space-y-4">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">
                    الإعدادات العامة
                </h2>
                
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                    {/* Notifications Toggle */}
                    <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center space-x-3 rtl:space-x-reverse">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                                <Bell size={20} />
                            </div>
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">تفعيل الإشعارات</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px]">
                                    استقبل التنبيهات عند فقد الإشارة أو انخفاض البطارية
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] rtl:after:right-[2px] rtl:after:left-auto rtl:peer-checked:after:-translate-x-full after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {/* Dark Mode Toggle */}
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3 rtl:space-x-reverse">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
                                {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                            </div>
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">الوضع الداكن</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    تفعيل الوضع الداكن في جميع الشاشات
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={theme === 'dark'} onChange={toggleTheme} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 dark:peer-focus:ring-slate-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] rtl:after:right-[2px] rtl:after:left-auto rtl:peer-checked:after:-translate-x-full after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-slate-800"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Language Section */}
            <div className="space-y-4">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">
                    اللغة
                </h2>
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 p-2 flex gap-2">
                    <button 
                        onClick={() => language !== 'ar' && toggleLanguage()}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                            language === 'ar' 
                            ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 font-medium' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                    >
                        <span>العربية</span>
                        <span className="text-lg">🇸🇦</span>
                    </button>
                    <button 
                        onClick={() => language !== 'en' && toggleLanguage()}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                            language === 'en' 
                            ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 font-medium' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                    >
                        <span>English</span>
                        <span className="text-lg">🇺🇸</span>
                    </button>
                </div>
            </div>

            {/* Users & App Themes */}
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                        <div className="p-2 bg-rose-100 dark:bg-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400">
                            <Shield size={20} />
                        </div>
                        <div className="text-start">
                            <p className="font-medium text-slate-900 dark:text-white">المستخدمون والصلاحيات</p>
                            <p className="text-xs text-slate-500">إدارة مستخدمي المعاينة وصلاحياتهم</p>
                        </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-400 rtl:rotate-180" />
                </button>
                
                <div className="p-4">
                    <div className="flex items-center space-x-3 rtl:space-x-reverse mb-4">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                            <Palette size={20} />
                        </div>
                        <div className="text-start">
                            <p className="font-medium text-slate-900 dark:text-white">سمات التطبيق</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col items-center gap-2 cursor-pointer">
                            <div className="w-full h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-800"></div>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">عادي</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 cursor-pointer opacity-50">
                            <div className="w-full h-16 rounded-xl bg-gradient-to-br from-orange-400 to-rose-400"></div>
                            <span className="text-xs text-slate-500">غروب</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 cursor-pointer opacity-50">
                            <div className="w-full h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500"></div>
                            <span className="text-xs text-slate-500">واحة</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Settings;
