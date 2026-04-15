import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useT } from '../../i18n';
import { Card, PageSkeleton } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { supabase } from '../../services/supabase';
import { createInviteCode, fetchInviteCodes, deactivateInviteCode } from '../../services/invites';

function SettingRow({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--t2)' }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function ProfileSection({ user }) {
  const t = useT();
  const { showToast } = useUIStore();
  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });
    setSaving(false);
    showToast(error ? 'Failed to update profile' : 'Profile updated!', error ? 'error' : 'success');
  };

  return (
    <Card title={t('profile')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gold)', fontFamily: 'var(--fd)', fontSize: 22, fontWeight: 600,
        }}>
          {(name || 'C').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{name || 'Coach'}</div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>{user?.email}</div>
        </div>
      </div>

      <SettingRow label={t('fullName')}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            className="form-inp"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: 180, fontSize: 12, padding: '6px 10px' }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ padding: '5px 12px', fontSize: 11 }}>
            {saving ? '...' : t('save')}
          </button>
        </div>
      </SettingRow>

      <SettingRow label={t('email')}>
        <span style={{ fontSize: 12, color: 'var(--t3)' }}>{user?.email}</span>
      </SettingRow>

      <SettingRow label={t('role')}>
        <span className="tag t-gold" style={{ fontSize: 10 }}>{t('coach')}</span>
      </SettingRow>
    </Card>
  );
}

function DefaultsSection() {
  const t = useT();
  const [stepTarget, setStepTarget] = useState(10000);
  const [defaultCalories, setDefaultCalories] = useState(2400);
  const [defaultProtein, setDefaultProtein] = useState(180);
  const { showToast } = useUIStore();

  return (
    <Card title={t('coachingDefaults')} subtitle={t('appliedToNewClients')}>
      <SettingRow label={t('defaultStepTarget')}>
        <input
          className="form-inp"
          type="number"
          value={stepTarget}
          onChange={e => setStepTarget(e.target.value)}
          style={{ width: 90, fontSize: 12, padding: '6px 10px', textAlign: 'right' }}
        />
      </SettingRow>
      <SettingRow label={t('defaultCalories')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            className="form-inp"
            type="number"
            value={defaultCalories}
            onChange={e => setDefaultCalories(e.target.value)}
            style={{ width: 80, fontSize: 12, padding: '6px 10px', textAlign: 'right' }}
          />
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>{t('kcal')}</span>
        </div>
      </SettingRow>
      <SettingRow label={t('defaultProteinTarget')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            className="form-inp"
            type="number"
            value={defaultProtein}
            onChange={e => setDefaultProtein(e.target.value)}
            style={{ width: 80, fontSize: 12, padding: '6px 10px', textAlign: 'right' }}
          />
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>{t('g')}</span>
        </div>
      </SettingRow>
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={() => showToast('Defaults saved!', 'success')}>
          {t('saveDefaults')}
        </button>
      </div>
    </Card>
  );
}

function InviteCodesSection({ coachId }) {
  const t = useT();
  const { showToast } = useUIStore();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!coachId) return;
    fetchInviteCodes(coachId)
      .then(data => setCodes(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [coachId]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const newCode = await createInviteCode(coachId, { maxUses: 1 });
      setCodes(prev => [newCode, ...prev]);
      showToast(`Code created: ${newCode.code}`, 'success');
    } catch {
      showToast('Failed to create code', 'error');
    }
    setCreating(false);
  };

  const handleDeactivate = async (id) => {
    try {
      await deactivateInviteCode(id);
      setCodes(prev => prev.map(c => c.id === id ? { ...c, active: false } : c));
      showToast('Code deactivated', 'success');
    } catch {
      showToast('Failed to deactivate', 'error');
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code);
    showToast('Copied to clipboard!', 'success');
  };

  const activeCodes = codes.filter(c => c.active !== false);
  const usedCodes = codes.filter(c => c.active === false || (c.used_count >= c.max_uses));

  return (
    <Card title={t('inviteCodes')} subtitle={t('generateCodesDesc')}>
      <div style={{ marginBottom: 14 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleCreate}
          disabled={creating}
          style={{ width: '100%' }}
        >
          <Icon name="plus" size={12} /> {creating ? t('creating') : t('generateNewCode')}
        </button>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : activeCodes.length === 0 && usedCodes.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: 16 }}>
          {t('noInviteCodesYet')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeCodes.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'var(--s2)', borderRadius: 8, border: '1px solid var(--border)',
            }}>
              <div style={{
                fontFamily: 'var(--fd)', fontSize: 18, letterSpacing: 3,
                color: 'var(--gold)', fontWeight: 600, flex: 1,
              }}>
                {c.code}
              </div>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>
                {c.used_count || 0}/{c.max_uses} {t('used')}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopy(c.code)}
                style={{ padding: '4px 8px', fontSize: 10 }}
              >
                {t('copy')}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleDeactivate(c.id)}
                style={{ padding: '4px 8px', fontSize: 10, color: 'var(--red)' }}
              >
                {t('revoke')}
              </button>
            </div>
          ))}
          {usedCodes.slice(0, 5).map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: 'var(--s1)', borderRadius: 8, opacity: 0.5,
            }}>
              <div style={{
                fontFamily: 'var(--fd)', fontSize: 16, letterSpacing: 3,
                color: 'var(--t3)', fontWeight: 600, flex: 1,
                textDecoration: 'line-through',
              }}>
                {c.code}
              </div>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>
                {c.label || t('usedRevoked')}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AppSection({ onSignOut }) {
  const t = useT();
  return (
    <Card title="App">
      <SettingRow label={t('appVersion')}>
        <span style={{ fontSize: 12, color: 'var(--t3)', fontFamily: 'var(--fm)' }}>1.0.0</span>
      </SettingRow>
      <SettingRow label={t('theme')}>
        <span className="tag" style={{ fontSize: 10 }}>{t('dark')}</span>
      </SettingRow>
      <div style={{ marginTop: 18 }}>
        <button
          className="btn btn-secondary"
          style={{ width: '100%', color: 'var(--red)', borderColor: 'var(--red)' }}
          onClick={onSignOut}
        >
          <Icon name="log-out" size={14} /> {t('signOut')}
        </button>
      </div>
    </Card>
  );
}

export default function CoachSettingsScreen() {
  const { user, signOut } = useAuthStore();

  return (
    <div className="screen active">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 600 }}>
        <ProfileSection user={user} />
        <InviteCodesSection coachId={user?.id} />
        <DefaultsSection />
        <AppSection onSignOut={signOut} />
      </div>
    </div>
  );
}
