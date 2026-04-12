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
import { useLanguageStore } from '@/store/languageStore';
import ViewShare from '@/pages/ViewShare';
import ShareManage from '@/pages/ShareManage';
import Settings from '@/pages/Settings';
import Devices from '@/pages/Devices';
import './i18n'; // Initialize i18n

function App() {
  const { theme } = useThemeStore();
  const { direction, language } = useLanguageStore();

  // Apply theme attribute to <html> so CSS vars switch globally
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Apply language and direction attributes globally
  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [direction, language]);

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
            <Route path="/devices" element={<Devices />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/settings" element={<Settings />} />
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
