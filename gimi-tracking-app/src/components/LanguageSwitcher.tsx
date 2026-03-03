import React from 'react';
import { useLanguageStore } from '../store/languageStore';
import { Languages } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
    const { language, toggleLanguage } = useLanguageStore();

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            aria-label="Toggle language"
        >
            <Languages className="w-4 h-4" />
            <span>{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
    );
};
