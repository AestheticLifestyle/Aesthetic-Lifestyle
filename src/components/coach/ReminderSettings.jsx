import { useState, useEffect } from 'react';
import { Card } from '../ui';
import { Icon } from '../../utils/icons';
import { fetchReminderRules, saveReminderRules } from '../../services/reminders';

const REMINDER_TYPES = [
  { key: 'daily_checkin', label: 'Daily Check-in', desc: 'Remind to submit daily check-in in the evening', emoji: '📋' },
  { key: 'weekly_checkin', label: 'Weekly Check-in', desc: 'Remind to submit weekly check-in on Sunday', emoji: '📊' },
  { key: 'meal_logging', label: 'Meal Logging', desc: 'Remind to log meals if none logged by afternoon', emoji: '🍽️' },
  { key: 'weight_logging', label: 'Morning Weigh-in', desc: 'Remind to log weight in the morning', emoji: '⚖️' },
  { key: 'workout_reminder', label: 'Workout Reminder', desc: 'Remind about scheduled training sessions', emoji: '💪' },
  { key: 'water_intake', label: 'Water Intake', desc: 'Remind to drink water if below target', emoji: '💧' },
  { key: 'step_target', label: 'Step Target', desc: 'Remind about step goal in the evening', emoji: '🚶' },
];

export default function ReminderSettings({ clientId, coachId }) {
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    fetchReminderRules(clientId).then(data => {
      setRules(data || {
        daily_checkin: true,
        weekly_checkin: true,
        meal_logging: true,
        weight_logging: true,
        workout_reminder: true,
        water_intake: true,
        step_target: true,
      });
      setLoading(false);
    });
  }, [clientId]);

  const handleToggle = async (key) => {
    const updated = { ...rules, [key]: !rules[key] };
    setRules(updated);
    setSaving(true);
    await saveReminderRules(coachId, clientId, updated);
    setSaving(false);
  };

  const enabledCount = rules ? REMINDER_TYPES.filter(t => rules[t.key]).length : 0;

  return (
    <Card title="Automated Reminders" subtitle={loading ? 'Loading...' : `${enabledCount}/${REMINDER_TYPES.length} active`}>
      {!expanded ? (
        // Compact view
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {REMINDER_TYPES.map(t => (
              <span key={t.key} style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 20,
                background: rules?.[t.key] ? 'var(--gold-d)' : 'var(--b2)',
                color: rules?.[t.key] ? 'var(--gold)' : 'var(--t3)',
                border: `1px solid ${rules?.[t.key] ? 'rgba(200,169,110,.2)' : 'transparent'}`,
              }}>
                {t.emoji} {t.label}
              </span>
            ))}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setExpanded(true)}
            style={{ width: '100%', fontSize: 11 }}
          >
            <Icon name="settings" size={12} /> Configure Reminders
          </button>
        </div>
      ) : (
        // Expanded view with toggles
        <div>
          {REMINDER_TYPES.map(t => (
            <div key={t.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
              borderBottom: '1px solid var(--b2)',
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{t.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{t.label}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', lineHeight: 1.3 }}>{t.desc}</div>
              </div>
              <button
                onClick={() => handleToggle(t.key)}
                disabled={saving}
                style={{
                  width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: rules?.[t.key] ? 'var(--gold)' : 'var(--b3)',
                  position: 'relative', transition: 'background .2s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: rules?.[t.key] ? 21 : 3,
                  transition: 'left .2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                }} />
              </button>
            </div>
          ))}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setExpanded(false)}
            style={{ width: '100%', marginTop: 10, fontSize: 11 }}
          >
            Done
          </button>
        </div>
      )}
    </Card>
  );
}
