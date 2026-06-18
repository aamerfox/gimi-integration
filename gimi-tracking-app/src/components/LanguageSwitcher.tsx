import React from 'react';
import { useLanguageStore } from '../store/languageStore';

export const LanguageSwitcher: React.FC = () => {
    const { language, toggleLanguage } = useLanguageStore();

    return (
        <button
            onClick={toggleLanguage}
            className="sx-lang-switcher"
            aria-label="Toggle language"
        >
            <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                className="sx-lang-icon"
                style={{ width: '18px', height: '18px' }}
            >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                <path d="M16 8L8 16" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
                <text 
                    x="8.5" 
                    y="9" 
                    fill="currentColor" 
                    fontSize="8px" 
                    fontWeight="800" 
                    fontFamily="'Inter', -apple-system, sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    stroke="none"
                >
                    A
                </text>
                <text 
                    x="15.5" 
                    y="15" 
                    fill="currentColor" 
                    fontSize="9.5" 
                    fontWeight="800" 
                    fontFamily="'IBM Plex Sans Arabic', 'Arial', sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    stroke="none"
                >
                    ع
                </text>
            </svg>
            <span className="sx-lang-text">{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
    );
};
