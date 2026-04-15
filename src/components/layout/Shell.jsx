import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../i18n';
import { COACH_NAV, CLIENT_NAV } from '../../utils/constants';
import { useDataLoader } from '../../hooks/useDataLoader';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../../utils/icons';

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export default function Shell() {
  // Load all data from Supabase on mount
  useDataLoader();

  const t = useT();
  const { sidebarOpen, closeSidebar, toast } = useUIStore();
  const { role } = useAuthStore();
  const location = useLocation();
  const online = useOnlineStatus();

  // Derive page title from current route
  const isCoach = role === 'coach';
  const navItems = isCoach ? COACH_NAV : CLIENT_NAV;
  const currentPath = location.pathname.split('/').pop();
  const currentNav = navItems.find(item => item.id === currentPath);
  const pageTitle = currentNav ? t(currentNav.label) : (isCoach ? t('coachDashboard') : t('navDashboard'));

  return (
    <div className="shell">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      <Sidebar />

      <div className="main-area">
        <Header title={pageTitle} />

        {/* Offline banner */}
        {!online && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '8px 16px', background: 'var(--red, #e74c3c)',
            color: '#fff', fontSize: 12, fontWeight: 600,
          }}>
            <Icon name="wifi-off" size={14} />
            {t('offlineBanner')}
          </div>
        )}

        <main className="main-content">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Toast notification — aria-live for screen readers */}
      <div aria-live="polite" aria-atomic="true">
        {toast && (
          <div className={`toast toast-${toast.type}`} role="status">
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
