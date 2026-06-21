export const COLORS = {
  dark: {
    bgPrimary: '#0B0F19',           // Saudi Space Blue background
    bgSecondary: '#16223F',         // Card container base
    bgElevated: '#1F2E54',          // Fields and selection highlights
    bgCard: 'rgba(22, 34, 63, 0.75)',// Frosted glass background
    accent: '#06B6D4',              // Neon Cyan accent
    accentDim: 'rgba(6, 182, 212, 0.15)', // Translucent Cyan highlight
    textPrimary: '#FFFFFF',         // White text
    textSecondary: '#94A3B8',       // Muted slate text
    textMuted: '#64748B',           // Faded label text
    border: 'rgba(255, 255, 255, 0.08)', // High-precision thin border
    online: '#10B981',              // Emerald Green (Active)
    offline: '#64748B',             // Slate Gray (Offline)
    warning: '#F59E0B',             // Amber Orange (Idle)
    danger: '#EF4444',              // Crimson Red
    tabBar: 'rgba(15, 23, 42, 0.75)',// Floating tab glass
    tabBarBorder: 'rgba(255, 255, 255, 0.06)',
    tint: '#06B6D4',
    text: '#FFFFFF',
    background: '#0B0F19',
    tabIconDefault: '#64748B',
    tabIconSelected: '#06B6D4',
  },
  light: {
    bgPrimary: '#F8FAFC',           // Off-white slate canvas
    bgSecondary: '#FFFFFF',         // Clean card backing
    bgElevated: '#F1F5F9',          // Standard input backing
    bgCard: 'rgba(255, 255, 255, 0.85)', // Premium light frost glass
    accent: '#1E3A8A',              // Saudi Royal Navy accent
    accentDim: 'rgba(30, 58, 138, 0.08)', // Soft navy tint
    textPrimary: '#1E3A8A',         // Royal Navy text
    textSecondary: '#475569',       // Slate gray description text
    textMuted: '#94A3B8',           // Light label text
    border: 'rgba(15, 23, 42, 0.06)', // Clean hairline divider
    online: '#10B981',
    offline: '#94A3B8',
    warning: '#D97706',
    danger: '#DC2626',
    tabBar: 'rgba(255, 255, 255, 0.85)',
    tabBarBorder: 'rgba(15, 23, 42, 0.05)',
    tint: '#1E3A8A',
    text: '#1E3A8A',
    background: '#F8FAFC',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#1E3A8A',
  },
} as const;

export type ThemeKey = 'dark' | 'light';
export type ColorScheme = typeof COLORS.dark;

export default COLORS;
