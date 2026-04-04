import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { Icon } from '../../utils/icons';

const PRIORITY_COLORS = {
  high: 'var(--red)',
  medium: 'var(--orange)',
  low: 'var(--t3)',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationPanel() {
  const { user } = useAuthStore();
  const {
    notifications, smartReminders, panelOpen, loading,
    closePanel, loadNotifications, markRead, markAllRead, dismissReminder,
  } = useNotificationStore();
  const panelRef = useRef();

  useEffect(() => {
    if (panelOpen && user?.id) {
      loadNotifications(user.id);
    }
  }, [panelOpen, user?.id]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        closePanel();
      }
    }
    if (panelOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [panelOpen]);

  if (!panelOpen) return null;

  const unreadNotifs = notifications.filter(n => !n.is_read);
  const readNotifs = notifications.filter(n => n.is_read).slice(0, 10);
  const hasUnread = unreadNotifs.length > 0 || smartReminders.length > 0;

  return (
    <div ref={panelRef} style={{
      position: 'absolute', top: 46, right: 8, width: 340, maxHeight: '70vh',
      background: 'var(--b1)', border: '1px solid var(--b3)', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)', zIndex: 1001,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--b2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Notifications</span>
        {hasUnread && (
          <button
            onClick={() => markAllRead(user?.id)}
            style={{ fontSize: 10, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Loading...</div>
        )}

        {/* Smart reminders (real-time, generated on load) */}
        {smartReminders.length > 0 && (
          <div style={{ padding: '8px 12px 4px' }}>
            <div style={{ fontSize: 9, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>
              Today's Reminders
            </div>
            {smartReminders.map(r => (
              <div key={r.type} style={{
                display: 'flex', gap: 10, padding: '10px', marginBottom: 4,
                background: 'var(--gold-d)', borderRadius: 8, border: '1px solid rgba(200,169,110,.15)',
                alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{r.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.4 }}>{r.message}</div>
                </div>
                <button
                  onClick={() => dismissReminder(r.type)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2, flexShrink: 0 }}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Unread notifications */}
        {unreadNotifs.length > 0 && (
          <div style={{ padding: '8px 12px 4px' }}>
            <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>
              New
            </div>
            {unreadNotifs.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                style={{
                  display: 'flex', gap: 10, padding: '10px', marginBottom: 4,
                  background: 'var(--b2)', borderRadius: 8, cursor: 'pointer',
                  borderLeft: '3px solid var(--gold)', alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: 'var(--gold-d)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name={n.icon || 'bell'} size={13} style={{ color: 'var(--gold)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 1 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.3 }}>{n.message}</div>
                  <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Read notifications */}
        {readNotifs.length > 0 && (
          <div style={{ padding: '8px 12px 4px' }}>
            <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>
              Earlier
            </div>
            {readNotifs.map(n => (
              <div key={n.id} style={{
                display: 'flex', gap: 10, padding: '8px 10px', marginBottom: 2,
                opacity: 0.6, alignItems: 'flex-start',
              }}>
                <Icon name={n.icon || 'bell'} size={13} style={{ color: 'var(--t3)', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)' }}>{n.title}</div>
                  <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 1 }}>{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && smartReminders.length === 0 && notifications.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>No notifications yet</div>
          </div>
        )}
      </div>
    </div>
  );
}
