import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useGeofenceDetection } from '../hooks/useGeofenceDetection';
import { useLocationPolling } from '../hooks/useLocationPolling';

export default function DashboardLayout() {
    // Global polling + detection — run on ALL pages
    useLocationPolling();
    useGeofenceDetection();

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar />
            <main style={{
                flex: 1,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
            }}>
                <Outlet />
            </main>
        </div>
    );
}
