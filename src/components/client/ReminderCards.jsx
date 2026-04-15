import { useNotificationStore } from '../../stores/notificationStore';
import { Icon } from '../../utils/icons';
import { useT } from '../../i18n';

const NAV_MAP = {
  daily_checkin: '/app/journal',
  weekly_checkin: '/app/journal',
  meal_logging: '/app/nutrition',
  weight_logging: null, // handled inline on dashboard
  workout: '/app/training',
  water: null,
  steps: null,
};

export default function ReminderCards({ navigate }) {
  const t = useT();
  const { smartReminders, dismissReminder } = useNotificationStore();

  if (!smartReminders.length) return null;

  // Show max 3 most important reminders
  const sorted = [...smartReminders].sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return (p[a.priority] || 2) - (p[b.priority] || 2);
  }).slice(0, 3);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, color: 'var(--gold)', textTransform: 'uppercase',
        letterSpacing: 1.2, marginBottom: 8, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>🔔</span> {t('remindersForToday')}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {sorted.map(r => {
          const navTo = NAV_MAP[r.type];
          return (
            <div
              key={r.type}
              onClick={() => navTo && navigate(navTo)}
              style={{
                flex: '1 1 200px', minWidth: 200,
                padding: '12px 14px', borderRadius: 10,
                background: r.priority === 'high' ? 'rgba(255,59,48,.08)' : 'var(--gold-d)',
                border: `1px solid ${r.priority === 'high' ? 'rgba(255,59,48,.15)' : 'rgba(200,169,110,.15)'}`,
                cursor: navTo ? 'pointer' : 'default',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                transition: 'transform .15s',
              }}
              onMouseEnter={e => navTo && (e.currentTarget.style.transform = 'scale(1.01)')}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{r.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{r.titleKey ? t(r.titleKey) : r.title}</div>
                <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.4 }}>{r.messageKey ? t(r.messageKey, r.messageParams) : r.message}</div>
                {navTo && (
                  <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 4, fontWeight: 500 }}>
                    {t('tapToGo')}
                  </div>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); dismissReminder(r.type); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2, flexShrink: 0 }}
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
