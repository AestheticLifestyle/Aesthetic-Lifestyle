import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { COACH_NAV, CLIENT_NAV } from '../../utils/constants';
import { useDataLoader } from '../../hooks/useDataLoader';
import { ErrorBoundary } from '../ui/ErrorBoundary';

export default function Shell() {
  // Load all data from Supabase on mount
  useDataLoader();

  const { sidebarOpen, closeSidebar, toast } = useUIStore();
  const { role } = useAuthStore();
  const location = useLocation();

  // Derive page title from current route
  const isCoach = role === 'coach';
  const navItems = isCoach ? COACH_NAV : CLIENT_NAV;
  const currentPath = location.pathname.split('/').pop();
  const currentNav = navItems.find(item => item.id === currentPath);
  const pageTitle = currentNav?.label || (isCoach ? 'Coach Dashboard' : 'Dashboard');

  return (
    <div className="shell">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      <Sidebar />

      <div className="main-area">
        <Header title={pageTitle} />
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
