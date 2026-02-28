import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useGeofenceDetection } from '../hooks/useGeofenceDetection';
import { useLocationPolling } from '../hooks/useLocationPolling';

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 768px)');
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    return isMobile;
}

export default function DashboardLayout() {
    // Global polling + detection — run on ALL pages
    useLocationPolling();
    useGeofenceDetection();

    const isMobile = useIsMobile();

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar />
            <main style={{
                flex: 1,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                // On mobile, the bottom nav takes 60px — give the content room
                paddingBottom: isMobile ? '60px' : 0,
            }}>
                <Outlet />
            </main>
        </div>
    );
}
