import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useThemeStore } from '../store/theme';
import { useGeofenceEventStore } from '../store/geofenceEvents';

const navItems = [
    {
        to: '/',
        label: 'Live Map',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 11.5 7.3 11.8a1 1 0 0 0 1.4 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
            </svg>
        ),
    },
    {
        to: '/history',
        label: 'History',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
        ),
    },
    {
        to: '/geofences',
        label: 'Geofences',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
            </svg>
        ),
    },
    {
        to: '/alerts',
        label: 'Alerts',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
        ),
    },
];

export default function Sidebar() {
    const [expanded, setExpanded] = useState(false);
    const navigate = useNavigate();
    const { userId, logout } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const { events } = useGeofenceEventStore();
    const unreadCount = events.filter(e => !e.read).length;
    const isLight = theme === 'light';

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside
            className="sidebar"
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            style={{
                width: expanded ? 'var(--sidebar-expanded)' : 'var(--sidebar-width)',
                minWidth: expanded ? 'var(--sidebar-expanded)' : 'var(--sidebar-width)',
                height: '100vh',
                background: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                position: 'relative',
                zIndex: 50,
                flexShrink: 0,
            }}
        >
            {/* Logo */}
            <div style={{
                height: 'var(--topbar-height)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: '12px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
            }}>
                <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, var(--accent), #00b894)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#0a0e1a" stroke="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                </div>
                <span style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    opacity: expanded ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                    letterSpacing: '-0.02em',
                }}>
                    SaudiEx
                </span>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                            background: isActive ? 'var(--accent-dim)' : 'transparent',
                            textDecoration: 'none',
                            fontSize: '13px',
                            fontWeight: isActive ? 600 : 400,
                            transition: 'all 0.15s ease',
                            whiteSpace: 'nowrap',
                            position: 'relative',
                        })}
                    >
                        <span style={{ flexShrink: 0, display: 'flex', position: 'relative' }}>
                            {item.icon}
                            {/* Unread badge on Alerts icon */}
                            {item.to === '/alerts' && unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -4,
                                    minWidth: 16,
                                    height: 16,
                                    borderRadius: '999px',
                                    background: 'var(--danger)',
                                    color: '#fff',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 3px',
                                    lineHeight: 1,
                                    animation: 'pulse 2s infinite',
                                }}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </span>
                        <span style={{
                            opacity: expanded ? 1 : 0,
                            transition: 'opacity 0.2s ease',
                        }}>
                            {item.label}
                            {item.to === '/alerts' && unreadCount > 0 && (
                                <span style={{
                                    marginLeft: 6,
                                    background: 'var(--danger)',
                                    color: '#fff',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    borderRadius: '999px',
                                    padding: '1px 5px',
                                }}>{unreadCount}</span>
                            )}
                        </span>
                    </NavLink>
                ))}
            </nav>

            {/* User / Logout */}
            <div style={{
                padding: '12px 8px',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
            }}>
                {expanded && userId && (
                    <div style={{
                        padding: '8px 12px',
                        marginBottom: '4px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                    }}>
                        {userId}
                    </div>
                )}

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    title={isLight ? 'Switch to Dark mode' : 'Switch to Light mode'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        width: '100%',
                        marginBottom: '2px',
                        transition: 'background 0.15s ease',
                        whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-dim)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    {isLight ? (
                        /* Moon — switch to dark */
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                        </svg>
                    ) : (
                        /* Sun — switch to light */
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                    )}
                    <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.2s ease' }}>
                        {isLight ? 'Dark Mode' : 'Light Mode'}
                    </span>
                </button>
                <button
                    onClick={handleLogout}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--danger)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        width: '100%',
                        transition: 'background 0.15s ease',
                        whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span style={{
                        opacity: expanded ? 1 : 0,
                        transition: 'opacity 0.2s ease',
                    }}>
                        Logout
                    </span>
                </button>
            </div>
        </aside>
    );
}
