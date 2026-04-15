import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useClientStore } from '../../stores/clientStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { saveClientGoal } from '../../services/checkins';
import { redeemInviteCode, getMyCoachLink, getCoachName, disconnectFromCoach } from '../../services/invites';
import { supabase } from '../../services/supabase';

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

// ── Preferences persistence ──
async function loadPreferences(userId) {
  try {
    const { data } = await supabase.from('profiles').select('preferences').eq('id', userId).single();
    return data?.preferences || {};
  } catch { return {}; }
}

async function savePreferences(userId, prefs) {
  const { error } = await supabase.from('profiles').update({ preferences: prefs }).eq('id', userId);
  return !error;
}

// ── Profile update ──
async function updateProfile(userId, fields) {
  // Update Supabase auth metadata
  const { error: authErr } = await supabase.auth.updateUser({ data: fields });
  if (authErr) return { ok: false, error: authErr.message };
  // Also update profiles table
  const payload = {};
  if (fields.full_name) payload.full_name = fields.full_name;
  if (Object.keys(payload).length) {
    await supabase.from('profiles').update(payload).eq('id', userId);
  }
  return { ok: true };
}

// ── Reusable components ──
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

// ── Edit Profile Modal ──
function EditProfileModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  const [saving, setSaving] = useState(false);
  const { showToast } = useUIStore();

  const handleSave = async () => {
    if (!name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    const result = await updateProfile(user.id, { full_name: name.trim() });
    setSaving(false);
    if (result.ok) {
      showToast('Profile updated!', 'success');
      onSaved?.({ full_name: name.trim() });
      onClose();
    } else {
      showToast(result.error || 'Failed to update', 'error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ background: 'var(--s0)', borderRadius: 14, width: 'min(400px, 90vw)', padding: 24, border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Edit Profile</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 4, display: 'block' }}>Full Name</label>
          <input
            className="form-inp"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 4, display: 'block' }}>Email</label>
          <div style={{ fontSize: 13, color: 'var(--t3)', padding: '8px 12px', background: 'var(--s2)', borderRadius: 8 }}>
            {user?.email || '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>Email can only be changed via Supabase dashboard</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
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
                padding: '12px 14px', borderRadius: 10,
                border: isActive ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                background: isActive ? 'var(--gold-d)' : 'var(--s2)',
                cursor: 'pointer', transition: 'all .15s', textAlign: 'left',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{g.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--gold)' : 'var(--t1)', letterSpacing: 0.3 }}>{g.label}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{g.desc}</div>
              </div>
              {isActive && (
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

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
      setConfirmDisconnect(false);
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
            {!confirmDisconnect ? (
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, color: 'var(--red, #e74c3c)' }}
                onClick={() => setConfirmDisconnect(true)}>
                Disconnect
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm" style={{ fontSize: 10, background: 'var(--red, #e74c3c)', color: '#fff' }}
                  onClick={handleDisconnect}>Confirm</button>
                <button className="btn btn-sm btn-ghost" style={{ fontSize: 10 }}
                  onClick={() => setConfirmDisconnect(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
            Enter an invite code from your coach to connect.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123" maxLength={6}
              style={{ flex: 1, letterSpacing: 3, fontFamily: 'var(--fd)', textAlign: 'center', fontSize: 16 }}
              autoComplete="off"
            />
            <button className="btn btn-primary btn-sm" onClick={handleRedeem} disabled={redeeming || !code.trim()}>
              {redeeming ? '...' : 'Connect'}
            </button>
          </div>
          {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>{error}</div>}
        </div>
      )}
    </Card>
  );
}

// ══════════════════════════════════════
// Main Settings Screen
// ══════════════════════════════════════
export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const { stepGoal, macroTargets } = useClientStore();
  const { showToast } = useUIStore();

  const [showEditProfile, setShowEditProfile] = useState(false);

  // Preferences — loaded from Supabase, persisted on change
  const [prefs, setPrefs] = useState({ notifications: true, reminders: true, darkMode: true, units: 'metric' });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadPreferences(user.id).then(p => {
      if (p && Object.keys(p).length) setPrefs(prev => ({ ...prev, ...p }));
      setPrefsLoaded(true);
    });
  }, [user?.id]);

  const updatePref = useCallback((key, value) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      // Fire-and-forget save
      if (user?.id) savePreferences(user.id, next).then(ok => {
        if (!ok) showToast('Preference not saved', 'error');
      });
      return next;
    });
  }, [user?.id, showToast]);

  const fullName = user?.user_metadata?.full_name || 'Athlete';
  const email = user?.email || '';

  return (
    <div className="screen active">
      {/* Edit Profile Modal */}
      {showEditProfile && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditProfile(false)}
          onSaved={() => {
            // The auth store will pick up the updated metadata on next getUser()
            showToast('Reload the app to see name change everywhere', 'success');
          }}
        />
      )}

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
        <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setShowEditProfile(true)}>
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
          <Toggle checked={prefs.notifications} onChange={() => updatePref('notifications', !prefs.notifications)} />
        </SettingRow>
        <SettingRow label="Daily Reminders" sub="Morning check-in, meal logging">
          <Toggle checked={prefs.reminders} onChange={() => updatePref('reminders', !prefs.reminders)} />
        </SettingRow>
        <SettingRow label="Dark Mode" sub={prefs.darkMode ? 'On' : 'Off'}>
          <Toggle checked={prefs.darkMode} onChange={() => updatePref('darkMode', !prefs.darkMode)} />
        </SettingRow>
        <SettingRow label="Units" sub="Weight and measurements">
          <div style={{ display: 'flex', gap: 4 }}>
            {['metric', 'imperial'].map(u => (
              <button key={u} className={`chip ${prefs.units === u ? 'active' : ''}`}
                onClick={() => updatePref('units', u)}>
                {u === 'metric' ? 'kg/cm' : 'lbs/in'}
              </button>
            ))}
          </div>
        </SettingRow>
      </Card>

      {/* Daily Goals */}
      <Card title="Daily Goals" subtitle="Set by your coach" style={{ marginTop: 14 }}>
        <SettingRow label="Step Goal" sub={`Currently: ${stepGoal?.toLocaleString() || '—'}`}>
          <span className="tag t-gold">{stepGoal?.toLocaleString() || '—'}</span>
        </SettingRow>
        <SettingRow label="Calorie Target" sub={`Currently: ${macroTargets?.calories || '—'}`}>
          <span className="tag t-gold">{macroTargets?.calories || '—'} kcal</span>
        </SettingRow>
        <SettingRow label="Protein Target" sub={`Currently: ${macroTargets?.protein || '—'}g`}>
          <span className="tag t-gr">{macroTargets?.protein || '—'}g</span>
        </SettingRow>
      </Card>

      {/* Account */}
      <Card title="Account" style={{ marginTop: 14 }}>
        <SettingRow label="App Version" sub="Aesthetic Lifestyle v2.0.0">
          <span className="tag t-gy">React + Capacitor</span>
        </SettingRow>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={logout}>
            <Icon name="log-out" size={13} /> Sign Out
          </button>
        </div>
      </Card>
    </div>
  );
}
