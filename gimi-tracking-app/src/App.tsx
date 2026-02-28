import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import HistoryPage from '@/pages/History';
import GeofencesPage from '@/pages/Geofences';
import AlertsPage from '@/pages/Alerts';
import DashboardLayout from '@/layouts/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useThemeStore } from '@/store/theme';
import ViewShare from '@/pages/ViewShare';
import ShareManage from '@/pages/ShareManage';

function App() {
  const { theme } = useThemeStore();

  // Apply theme attribute to <html> so CSS vars switch globally
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/share" element={<ViewShare />} />

        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/geofences" element={<GeofencesPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/share-manage" element={<ShareManage />} />
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
