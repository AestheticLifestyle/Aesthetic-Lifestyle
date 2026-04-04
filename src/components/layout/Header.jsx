import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { Icon } from '../../utils/icons';
import NotificationPanel from './NotificationPanel';

export default function Header({ title }) {
  const { role } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const { panelOpen, togglePanel, notifications, smartReminders } = useNotificationStore();
  const isCoach = role === 'coach';

  const unreadCount = notifications.filter(n => !n.is_read).length + smartReminders.length;

  return (
    <header className="app-header">
      <button className="menu-btn" onClick={toggleSidebar} aria-label="Toggle menu">
        <Icon name="menu" size={18} />
      </button>

      <h1 className="header-title">{title}</h1>

      <div className="header-right" style={{ position: 'relative' }}>
        <button
          className="icon-btn"
          aria-label="Notifications"
          onClick={togglePanel}
          style={{ position: 'relative' }}
        >
          <Icon name="bell" size={17} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              width: 16, height: 16, borderRadius: '50%',
              background: 'var(--red)', color: '#fff',
              fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--bg)',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <NotificationPanel />
        <div className="rt-dot" title="Live sync active" />
      </div>
    </header>
  );
}
