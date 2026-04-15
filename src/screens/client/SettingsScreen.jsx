import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useClientStore } from '../../stores/clientStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { saveClientGoal } from '../../services/checkins';
import { redeemInviteCode, getMyCoachLink, getCoachName, disconnectFromCoach } from '../../services/invites';
import { supabase } from '../../services/supabase';
import { useT } from '../../i18n';

// ── Goal config (labels & descriptions will be translated via i18n) ──
const GOALS = [
  { id: 'cut',       labelKey: 'cut',       icon: '🔥', descKey: 'cutDesc' },
  { id: 'lean-bulk', labelKey: 'leanBulk',  icon: '💪', descKey: 'leanBulkDesc' },
  { id: 'recomp',    labelKey: 'bodyRecomp', icon: '⚖️', descKey: 'bodyRecompDesc' },
  { id: 'maintenance',labelKey: 'maintenance', icon: '🛡️', descKey: 'maintenanceDesc' },
  { id: 'comp-prep', labelKey: 'compPrep',  icon: '🏆', descKey: 'compPrepDesc' },
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
  const t = useT();
  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  const [saving, setSaving] = useState(false);
  const { showToast } = useUIStore();

  const handleSave = async () => {
    if (!name.trim()) { showToast(t('nameRequired'), 'error'); return; }
    setSaving(true);
    const result = await updateProfile(user.id, { full_name: name.trim() });
    setSaving(false);
    if (result.ok) {
      showToast(t('profileUpdated'), 'success');
      onSaved?.({ full_name: name.trim() });
      onClose();
    } else {
      showToast(result.error || t('failedToUpdate'), 'error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ background: 'var(--s0)', borderRadius: 14, width: 'min(400px, 90vw)', padding: 24, border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('editProfile')}</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 4, display: 'block' }}>{t('fullName')}</label>
          <input
            className="form-inp"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('yourName')}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 4, display: 'block' }}>{t('email')}</label>
          <div style={{ fontSize: 13, color: 'var(--t3)', padding: '8px 12px', background: 'var(--s2)', borderRadius: 8 }}>
            {user?.email || '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>{t('emailCantChange')}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={handleSave}>
            {saving ? `${t('saving')}...` : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Goal selector card ──
function GoalSelector() {
  const t = useT();
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
    showToast(ok ? t('goalUpdated') : t('failedToSaveGoal'), ok ? 'success' : 'error');
  };

  return (
    <Card title={t('trainingGoal')} subtitle={t('whatAreYouWorkingTowards')} style={{ marginTop: 14 }}>
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
                <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--gold)' : 'var(--t1)', letterSpacing: 0.3 }}>{t(g.labelKey)}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{t(g.descKey)}</div>
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
  const t = useT();
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
      showToast(t('connectedToCoach'), 'success');
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
      showToast(t('disconnectedFromCoach'), 'success');
    } catch {
      showToast(t('failedToDisconnect'), 'error');
    }
  };

  if (loading) return null;

  return (
    <Card title="Coach" subtitle={linked ? t('connected') : t('notConnected')} style={{ marginTop: 14 }}>
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
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{t('yourCoach')}</div>
            </div>
            {!confirmDisconnect ? (
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, color: 'var(--red, #e74c3c)' }}
                onClick={() => setConfirmDisconnect(true)}>
                {t('disconnect')}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm" style={{ fontSize: 10, background: 'var(--red, #e74c3c)', color: '#fff' }}
                  onClick={handleDisconnect}>{t('confirm')}</button>
                <button className="btn btn-sm btn-ghost" style={{ fontSize: 10 }}
                  onClick={() => setConfirmDisconnect(false)}>{t('cancel')}</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
            {t('enterInviteCode')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder={t('inviteCodePlaceholder')} maxLength={6}
              style={{ flex: 1, letterSpacing: 3, fontFamily: 'var(--fd)', textAlign: 'center', fontSize: 16 }}
              autoComplete="off"
            />
            <button className="btn btn-primary btn-sm" onClick={handleRedeem} disabled={redeeming || !code.trim()}>
              {redeeming ? '...' : t('connect')}
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
  const t = useT();
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
      if (p && Object.keys(p).length) {
        setPrefs(prev => ({ ...prev, ...p }));
      }
      setPrefsLoaded(true);
    });
  }, [user?.id]);

  const updatePref = useCallback((key, value) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      // Fire-and-forget save
      if (user?.id) savePreferences(user.id, next).then(ok => {
        if (!ok) showToast(t('preferencesNotSaved'), 'error');
      });
      return next;
    });
  }, [user?.id, showToast, t]);

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
      <Card title={t('profile')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', background: 'var(--gold-d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gold)', fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 600,
          }}>
            {(fullName || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{fullName}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>{email}</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setShowEditProfile(true)}>
          <Icon name="edit" size={12} /> {t('editProfile')}
        </button>
      </Card>

      {/* Coach Connection */}
      <CoachConnection />

      {/* Training Goal */}
      <GoalSelector />

      {/* Preferences */}
      <Card title={t('preferences')} style={{ marginTop: 14 }}>
        <SettingRow label={t('pushNotifications')} sub={t('pushNotificationsDesc')}>
          <Toggle checked={prefs.notifications} onChange={() => updatePref('notifications', !prefs.notifications)} />
        </SettingRow>
        <SettingRow label={t('dailyReminders')} sub={t('dailyRemindersDesc')}>
          <Toggle checked={prefs.reminders} onChange={() => updatePref('reminders', !prefs.reminders)} />
        </SettingRow>
        <SettingRow label={t('darkMode')} sub={prefs.darkMode ? t('on') : t('off')}>
          <Toggle checked={prefs.darkMode} onChange={() => updatePref('darkMode', !prefs.darkMode)} />
        </SettingRow>
        <SettingRow label={t('units')} sub={t('unitsDesc')}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['metric', 'imperial'].map(u => (
              <button key={u} className={`chip ${prefs.units === u ? 'active' : ''}`}
                onClick={() => updatePref('units', u)}>
                {u === 'metric' ? t('kgCm') : t('lbsIn')}
              </button>
            ))}
          </div>
        </SettingRow>
      </Card>

      {/* Daily Goals */}
      <Card title={t('dailyGoals')} subtitle={t('setByYourCoach')} style={{ marginTop: 14 }}>
        <SettingRow label={t('stepGoalLabel')} sub={t('currently', { value: stepGoal?.toLocaleString() || '—' })}>
          <span className="tag t-gold">{stepGoal?.toLocaleString() || '—'}</span>
        </SettingRow>
        <SettingRow label={t('calorieTarget')} sub={t('currently', { value: macroTargets?.calories || '—' })}>
          <span className="tag t-gold">{macroTargets?.calories || '—'} kcal</span>
        </SettingRow>
        <SettingRow label={t('proteinTarget')} sub={t('currently', { value: `${macroTargets?.protein || '—'}g` })}>
          <span className="tag t-gr">{macroTargets?.protein || '—'}g</span>
        </SettingRow>
      </Card>

      {/* Account */}
      <Card title={t('account')} style={{ marginTop: 14 }}>
        <SettingRow label={t('appVersion')} sub={t('appVersionValue')}>
          <span className="tag t-gy">{t('appVersionSub')}</span>
        </SettingRow>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={logout}>
            <Icon name="log-out" size={13} /> {t('signOut')}
          </button>
        </div>
      </Card>
    </div>
  );
}
