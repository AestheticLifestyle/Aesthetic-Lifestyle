import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useClientStore } from '../../stores/clientStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { saveClientGoal } from '../../services/checkins';
import { redeemInviteCode, getMyCoachLink, getCoachName, disconnectFromCoach } from '../../services/invites';

// ── Goal config ──
const GOALS = [
  { id: 'cut',       label: 'Cut',           icon: '🔥', desc: 'Fat loss focus — deficit, high protein, more cardio' },
  { id: 'lean-bulk', label: 'Lean Bulk',      icon: '💪', desc: 'Muscle gain — slight surplus, progressive overload' },
  { id: 'recomp',    label: 'Body Recomp',    icon: '⚖️', desc: 'Lose fat + build muscle — maintenance cals, high protein' },
  { id: 'maintenance',label: 'Maintenance',   icon: '🛡️', desc: 'Hold current physique — sustain habits' },
  { id: 'comp-prep', label: 'Comp Prep',      icon: '🏆', desc: 'Contest / photoshoot prep — aggressive cut, peak week' },
];

function getClientId() {
  const authState = useAuthStore.getState();
  return authState.roleOverride
    ? (sessionStorage.getItem('overrideClientId') || authState.user?.id)
    : authState.user?.id;
}

function SettingRow({ label, sub, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="toggle-track" />
      <span className="toggle-thumb" />
    </label>
  );
}

// ── Goal selector card ──
function GoalSelector() {
  const goal = useClientStore(s => s.goal);
  const setGoal = useClientStore(s => s.setGoal);
  const { showToast } = useUIStore();
  const [saving, setSaving] = useState(false);

  const handleSelect = async (goalId) => {
    if (goalId === goal) return;
    setSaving(true);
    setGoal(goalId);
    const ok = await saveClientGoal(getClientId(), goalId);
    setSaving(false);
    showToast(ok ? 'Goal updated!' : 'Failed to save goal', ok ? 'success' : 'error');
  };

  return (
    <Card title="Training Goal" subtitle="What are you working towards?" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        {GOALS.map(g => {
          const isActive = goal === g.id;
          return (
            <button
              key={g.id}
              disabled={saving}
              onClick={() => handleSelect(g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                borderRadius: 10,
                border: isActive ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                background: isActive ? 'var(--gold-d)' : 'var(--s2)',
                cursor: 'pointer',
                transition: 'all .15s',
                textAlign: 'left',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{g.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: isActive ? 'var(--gold)' : 'var(--t1)',
                  letterSpacing: 0.3,
                }}>
                  {g.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                  {g.desc}
                </div>
              </div>
              {isActive && (
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--gold)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name="check" size={11} style={{ color: '#000' }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── Coach Connection Card ──
function CoachConnection() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [coachName, setCoachName] = useState(null);
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    getMyCoachLink(user.id).then(async (coachId) => {
      if (coachId) {
        setLinked(true);
        const name = await getCoachName(coachId);
        setCoachName(name);
      }
      setLoading(false);
    });
  }, [user?.id]);

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    setError('');
    const result = await redeemInviteCode(user.id, code.trim());
    if (result.success) {
      showToast('Connected to coach!', 'success');
      const name = await getCoachName(result.coachId);
      setCoachName(name);
      setLinked(true);
      setCode('');
    } else {
      setError(result.error);
    }
    setRedeeming(false);
  };

  const handleDisconnect = async () => {
    try {
      await disconnectFromCoach(user.id);
      setLinked(false);
      setCoachName(null);
      showToast('Disconnected from coach', 'success');
    } catch {
      showToast('Failed to disconnect', 'error');
    }
  };

  if (loading) return null;

  return (
    <Card title="Coach" subtitle={linked ? 'Connected' : 'Not connected'} style={{ marginTop: 14 }}>
      {linked ? (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            background: 'rgba(212,175,55,.06)', borderRadius: 10,
            border: '1px solid rgba(212,175,55,.15)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: 'var(--gold-d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold)', fontFamily: 'var(--fd)', fontSize: 14, fontWeight: 600,
            }}>
              {coachName?.charAt(0) || 'C'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>{coachName}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>Your Coach</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 10, color: 'var(--red)' }}
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
            Enter an invite code from your coach to connect.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              style={{
                flex: 1, letterSpacing: 3, fontFamily: 'var(--fd)',
                textAlign: 'center', fontSize: 16,
              }}
              autoComplete="off"
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRedeem}
              disabled={redeeming || !code.trim()}
            >
              {redeeming ? '...' : 'Connect'}
            </button>
          </div>
          {error && (
            <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>{error}</div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const { stepGoal, macroTargets } = useClientStore();
  const { showToast } = useUIStore();

  const [notifications, setNotifications] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [units, setUnits] = useState('metric');

  const fullName = user?.user_metadata?.full_name || 'Athlete';
  const email = user?.email || '';

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="screen active">
      {/* Profile */}
      <Card title="Profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', background: 'var(--gold-d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gold)', fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 600,
          }}>
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{fullName}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>{email}</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
          <Icon name="edit" size={12} /> Edit Profile
        </button>
      </Card>

      {/* Coach Connection */}
      <CoachConnection />

      {/* Training Goal */}
      <GoalSelector />

      {/* Preferences */}
      <Card title="Preferences" style={{ marginTop: 14 }}>
        <SettingRow label="Push Notifications" sub="Workout reminders, coach messages">
          <Toggle checked={notifications} onChange={() => setNotifications(!notifications)} />
        </SettingRow>
        <SettingRow label="Daily Reminders" sub="Morning check-in, meal logging">
          <Toggle checked={reminders} onChange={() => setReminders(!reminders)} />
        </SettingRow>
        <SettingRow label="Dark Mode" sub="Always on by default">
          <Toggle checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
        </SettingRow>
        <SettingRow label="Units" sub="Weight and measurements">
          <div style={{ display: 'flex', gap: 4 }}>
            {['metric', 'imperial'].map(u => (
              <button
                key={u}
                className={`chip ${units === u ? 'active' : ''}`}
                onClick={() => setUnits(u)}
              >
                {u === 'metric' ? 'kg/cm' : 'lbs/in'}
              </button>
            ))}
          </div>
        </SettingRow>
      </Card>

      {/* Daily Goals */}
      <Card title="Daily Goals" style={{ marginTop: 14 }}>
        <SettingRow label="Step Goal" sub={`Currently: ${stepGoal.toLocaleString()}`}>
          <span className="tag t-gold">{stepGoal.toLocaleString()}</span>
        </SettingRow>
        <SettingRow label="Calorie Target" sub={`Currently: ${macroTargets.calories}`}>
          <span className="tag t-gold">{macroTargets.calories} kcal</span>
        </SettingRow>
        <SettingRow label="Protein Target" sub={`Currently: ${macroTargets.protein}g`}>
          <span className="tag t-gr">{macroTargets.protein}g</span>
        </SettingRow>
      </Card>

      {/* Account */}
      <Card title="Account" style={{ marginTop: 14 }}>
        <SettingRow label="App Version" sub="Aesthetic Lifestyle v2.0.0">
          <span className="tag t-gy">React + Capacitor</span>
        </SettingRow>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleLogout}>
            <Icon name="log-out" size={13} /> Sign Out
          </button>
        </div>
      </Card>
    </div>
  );
}
